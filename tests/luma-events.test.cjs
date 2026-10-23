const test=require('node:test');const assert=require('node:assert/strict');
const {coverImage,loadEvents}=require('../netlify/functions/luma-events.cjs');
test('extracts cover metadata regardless of attribute order and decodes URL entities',()=>{
 assert.equal(coverImage(`<meta content='https://images.lumacdn.com/a.png?x=1&amp;y=2' property='og:image'>`),'https://images.lumacdn.com/a.png?x=1&y=2');
 assert.equal(coverImage('<meta property="og:image" content="javascript:alert(1)">'),null);
 assert.equal(coverImage('<meta property="og:image" content="https://evil.example/a.png">'),null);
});
test('retains a usable event when the image page fails',async()=>{
 const feed='BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:a\nDTSTART:20261025T090000Z\nSUMMARY:Meditation\nURL:https://luma.com/a\nEND:VEVENT\nEND:VCALENDAR';
 const events=await loadEvents(async url=>{if(url.includes('/ics/'))return {ok:true,text:async()=>feed};throw Error('Offline');},new Date('2026-10-18T00:00:00Z'));
 assert.equal(events.length,1);assert.equal(events[0].cover_url,null);assert.equal(events[0].url,'https://luma.com/a');
});
test('prefers original event art from structured data over the sharing card',()=>{
 const html='<meta property="og:image" content="https://images.lumacdn.com/social.png"><script type="application/ld+json">{"@type":"Event","image":["https://images.lumacdn.com/original.png"]}</script>';
 assert.equal(coverImage(html),'https://images.lumacdn.com/original.png');
});
test('reads descriptions from event metadata and tolerates malformed JSON',()=>{
 const {eventDescription}=require('../netlify/functions/luma-events.cjs');
 assert.equal(eventDescription('<script type="application/ld+json">{"@type":"Event","description":"Sit together in silence."}</script>'),'Sit together in silence.');
 assert.equal(eventDescription('<script type="application/ld+json">invalid</script>'),'');
});
