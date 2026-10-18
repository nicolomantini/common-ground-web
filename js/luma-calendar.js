/* Luma's public iCal feed uses UTC timestamps. No private calendar access needed. */
const LumaCalendar = (() => {
  const unescape = value => value.replace(/\\([nN,;\\])/g, (_, c) => /n/i.test(c) ? '\n' : c);
  function date(value) {
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value || '');
    if (!m) return null;
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
    const result = new Date(iso);
    return Number.isFinite(+result) && result.toISOString() === iso ? result : null;
  }
  function safeURL(value) {
    try {
      const u = new URL(value);
      return u.protocol === 'https:' && ['luma.com', 'lu.ma'].includes(u.hostname) && !u.username && !u.password ? u.href : null;
    } catch { return null; }
  }
  function upcoming(text, now = new Date()) {
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Invalid calendar response');
    const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    const events = new Map();
    let event = null, depth = 0;
    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') { event = {}; depth = 0; continue; }
      if (!event) continue;
      if (line === 'END:VEVENT') {
        const start = date(event.DTSTART);
        const description = unescape(event.DESCRIPTION || '');
        const url = safeURL(event.URL) || safeURL(description.match(/https:\/\/(?:luma\.com|lu\.ma)\/[^\s]+/)?.[0]) || safeURL(event.LOCATION);
        const id = event.UID || url;
        if (id) events.set(id, { title: unescape(event.SUMMARY || ''), start, url,
          hosts: description.match(/(?:^|\n)Hosted by ([^\n]+)/)?.[1] || '', cancelled: event.STATUS === 'CANCELLED' });
        event = null; continue;
      }
      if (line.startsWith('BEGIN:')) { depth++; continue; }
      if (line.startsWith('END:')) { depth--; continue; }
      if (depth) continue;
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const name = line.slice(0, colon).split(';')[0].toUpperCase();
      event[name] = line.slice(colon + 1);
    }
    return [...events.values()].filter(e => e.start && e.start > now && e.url && e.title && !e.cancelled)
      .sort((a,b) => a.start - b.start).slice(0,3);
  }
  return { upcoming };
})();
if (typeof module !== 'undefined') module.exports = LumaCalendar;
