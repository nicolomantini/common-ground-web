const { upcoming } = require('../../js/luma-calendar.js');
const FEED = 'https://api.luma.com/ics/get?entity=calendar&id=cal-JH15u7C3rjl6O91';
const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x([0-9a-f]+);|&#(\d+);/gi, (_, hex, decimal) => {
  const code = parseInt(hex || decimal, hex ? 16 : 10);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
});
function imageURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'images.lumacdn.com' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function eventDescription(html) {
  for (const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(script[1]);
      const records = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];
      const record = records.find(item => [item['@type']].flat().includes('Event'));
      if (typeof record?.description === 'string') return record.description.slice(0, 2000);
    } catch { /* Description is optional. */ }
  }
  return '';
}
function coverImage(html) {
  // Prefer the original event artwork in public Schema.org metadata, not Luma's promotional sharing card.
  for (const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(script[1]);
      const records = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];
      for (const record of records) {
        if (![record['@type']].flat().includes('Event')) continue;
        for (const image of [record.image].flat()) {
          const url = imageURL(typeof image === 'string' ? image : image?.url);
          if (url) return url;
        }
      }
    } catch { /* Fall back to the sharing image when structured metadata changes. */ }
  }
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes = {};
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attributes[match[1].toLowerCase()] = decode(match[2] ?? match[3]);
    if (attributes.property !== 'og:image' || !attributes.content) continue;
    try {
      const url = new URL(attributes.content);
      if (url.protocol === 'https:' && url.hostname === 'images.lumacdn.com' && !url.username && !url.password) return url.href;
    } catch { /* A missing image must not hide an event. */ }
  }
  return null;
}
async function loadEvents(fetcher = fetch, now = new Date()) {
  const response = await fetcher(FEED, {signal: AbortSignal.timeout(8000), redirect: 'error'});
  if (!response.ok) throw new Error('Calendar unavailable');
  const events = upcoming(await response.text(), now);
  return Promise.all(events.map(async event => {
    let cover_url = null, description = '';
    try {
      const page = await fetcher(event.url, {signal: AbortSignal.timeout(5000), redirect: 'error'});
      if (page.ok) { const html = await page.text(); cover_url = coverImage(html); description = eventDescription(html); }
    } catch { /* Keep dates and registration usable when Luma's page is unavailable. */ }
    return {...event, cover_url, description};
  }));
}
exports.handler = async ({httpMethod}) => {
  if (httpMethod !== 'GET') return {statusCode:405, headers:{Allow:'GET'}, body:''};
  try {
    return {statusCode:200, headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=60, s-maxage=300'}, body:JSON.stringify({events:await loadEvents()})};
  } catch {
    return {statusCode:502, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}, body:JSON.stringify({error:'Calendar temporarily unavailable'})};
  }
};
exports.coverImage = coverImage;
exports.loadEvents = loadEvents;

exports.eventDescription = eventDescription;
