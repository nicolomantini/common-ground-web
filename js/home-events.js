/* Live Luma invitations, displayed in the website's own style. */
(async () => {
  const list = document.getElementById('home-events');
  const message = document.getElementById('home-events-message');
  if (!list || !message) return;
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch('/api/luma-events', {signal: controller.signal});
    if (!response.ok) throw new Error('Calendar unavailable');
    const data = await response.json();
    if (!Array.isArray(data.events)) throw new Error('Invalid events');
    const events = data.events.map(event => ({...event, start: new Date(event.start)}));
    const zone = 'Europe/Zurich';
    list.replaceChildren();
    for (const event of events) {
      const card = node('article', undefined, 'luma-event-card');
      const content = node('div', undefined, 'luma-event-content');
      const date = node('time', event.start.toLocaleDateString('en-GB', {
        day:'numeric', month:'long', year:'numeric', timeZone:zone
      }) + ' · ' + event.start.toLocaleTimeString('en-GB', {
        hour:'2-digit', minute:'2-digit', timeZone:zone, timeZoneName:'short'
      }), 'luma-event-time');
      date.dateTime = event.start.toISOString();
      content.append(date, node('h3', event.title));
      if (event.description) {
        const plain = new DOMParser().parseFromString(event.description, 'text/html').body.textContent;
        content.append(node('p', plain, 'luma-event-description'));
      }
      const register = node('a', 'Register', 'btn-primary luma-event-register');
      register.href = event.url; register.target = '_blank'; register.rel = 'noopener noreferrer';
      register.append(node('span', ` for ${event.title} (opens in a new tab)`, 'visually-hidden'));
      const cover = node('div', undefined, 'luma-event-cover');
      cover.setAttribute('aria-hidden', 'true');
      if (event.cover_url) {
        const image = node('img'); image.src = event.cover_url; image.alt = ''; image.loading = 'lazy';
        image.addEventListener('error', () => image.remove()); cover.append(image);
      }
      const body = node('div', undefined, 'luma-event-body');
      const footer = node('div', undefined, 'luma-event-footer');
      if (event.hosts) {
        const group = node('div', undefined, 'luma-event-host-group');
        group.append(node('p', 'Hosted by', 'event-host-label'));
        const hosts = node('div', undefined, 'event-hosts');
        for (const name of event.hosts.split(/\s+&\s+|,\s*/)) {
          const host = node('span', name.trim(), 'event-host');
          host.dataset.hostName = name.trim(); hosts.append(host);
        }
        group.append(hosts); footer.append(group);
      }
      footer.append(register);
      body.append(content, footer); card.append(cover, body); list.append(card);
    }
    // Profile photos are optional; never hold up the Luma invitations for them.
    if (typeof supabaseClient !== 'undefined') {
      supabaseClient.from('counselors').select('name,photo').then(({data}) => {
        const normal = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
        for (const host of list.querySelectorAll('[data-host-name]')) {
          const person = (data || []).find(p => normal(p.name || '') === normal(host.dataset.hostName));
          if (!person?.photo) continue;
          try { if (new URL(person.photo).protocol !== 'https:') continue; } catch { continue; }
          const avatar = node('span', undefined, 'event-avatar');
          const image = node('img'); image.src = person.photo; image.alt = ''; image.loading = 'lazy';
          image.addEventListener('error', () => avatar.remove()); avatar.append(image); host.prepend(avatar);
        }
      }).catch(() => {});
    }
    message.textContent = events.length ? '' : 'New gatherings are on their way. Follow our Luma calendar for the next invitation.';
    message.hidden = events.length > 0;
  } catch {
    message.hidden = false;
    message.textContent = 'Our calendar could not load. View all events on Luma below.';
  } finally { clearTimeout(timeout); }
})();
