/* Shared event cards for the homepage and events directory. */
const EventCards = (() => {
  const node = Journal.node;
  function avatar(person) {
    const el = node('span', (person.name || '?').split(' ').map(p=>p[0]).slice(0,2).join(''), 'event-avatar');
    el.setAttribute('aria-hidden','true');
    const url = Journal.httpsURL(person.photo);
    if(url) {
      const img = node('img'); img.src=url; img.alt=''; img.loading='lazy';
      img.addEventListener('error',()=>img.remove()); el.append(img);
    }
    return el;
  }
  function render(event, practitioners = [], heading = 'h2') {
      const url = Journal.httpsURL(event.url);
      if (!url) return null;
      const link = node('article', undefined, 'event-link');
      const cover=Journal.httpsURL(event.cover_url);
      function coverFallback() {
        if (heading !== 'h3') return;
        const mark = node('div', undefined, 'event-cover-placeholder');
        mark.setAttribute('aria-hidden', 'true'); link.prepend(mark);
      }
      if (!cover) coverFallback();
      if(cover){const img=node('img',undefined,'event-cover');img.src=cover;img.alt=event.cover_alt || '';img.loading='lazy';img.addEventListener('error',()=>{img.remove();coverFallback();});link.append(img);}
      const content=node('div',undefined,'event-content');link.append(content);
      content.append(node(heading, event.title));
      if (event.description) content.append(node('p', event.description));
      if (event.event_date) {
        const date = node('time', new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-GB', {day:'numeric', month:'long', year:'numeric'}));
        date.dateTime = event.event_date; content.prepend(date);
      }
      const register = node('a', 'Register', 'btn-primary event-register');
      register.href = url; register.target = '_blank'; register.rel = 'noopener noreferrer';
      register.append(node('span', ` for ${event.title} (opens in a new tab)`, 'visually-hidden'));
      const footer=node('div',undefined,'event-card-footer');
      const hosts=node('div',undefined,'event-hosts');
      for(const id of event.host_ids || []) {
        const person=practitioners.find(p=>p.id===id);if(!person)continue;
        const host=node('a',undefined,'event-host');host.href=`/index.html?practitioner=${encodeURIComponent(id)}#directory`;
        host.append(avatar(person),node('span',person.name));hosts.append(host);
      }
      if(hosts.children.length){const group=node('div');group.append(node('p','Hosted by','event-host-label'),hosts);footer.append(group);}
      footer.append(register);content.append(footer);
      return link;
  }
  return {avatar, render};
})();
