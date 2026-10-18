const test = require('node:test');
const assert = require('node:assert/strict');
const {upcoming} = require('../js/luma-calendar.js');
const event = (id,start,extra='') => `BEGIN:VEVENT\nUID:${id}\nDTSTART:${start}\nSUMMARY:Event ${id}\nDESCRIPTION:Get details at: https://luma.com/${id}\\n\\nHosted by Anneleen\n Rabijns\n${extra}\nEND:VEVENT`;
const feed = events => `BEGIN:VCALENDAR\n${events.join('\n')}\nEND:VCALENDAR`;
const now = new Date('2026-10-18T08:00:00Z');
test('filters past, started and cancelled events; sorts next three, including today',()=>{
 const events=upcoming(feed([event('later','20261029T090000Z'),event('today','20261018T090000Z'),event('past','20261017T090000Z'),event('started','20261018T080000Z'),event('cancelled','20261020T090000Z','STATUS:CANCELLED'),event('next','20261025T090000Z'),event('fourth','20261030T090000Z')]),now);
 assert.deepEqual(events.map(e=>e.title),['Event today','Event next','Event later']);
 assert.equal(events[0].hosts,'AnneleenRabijns');
 assert.equal(events[1].start.toISOString(),'2026-10-25T09:00:00.000Z');
});
test('unfolds lines and decodes escaped titles',()=>{
 const result=upcoming(feed([event('one','20261025T090000Z').replace('SUMMARY:Event one','SUMMARY:Presence\\, truth\\; and\n  inquiry')]),now);
 assert.equal(result[0].title,'Presence, truth; and inquiry');
});
test('rejects invalid dates, unsafe links and unrelated responses',()=>{
 assert.equal(upcoming(feed([event('bad','20261325T090000Z'),event('floating','20261025T090000'),event('unsafe','20261025T090000Z').replace('https://luma.com/unsafe','javascript:alert(1)')]),now).length,0);
 assert.throws(()=>upcoming('<html>Error</html>',now));
});
test('deduplicates events and handles empty calendars',()=>{
 assert.equal(upcoming(feed([event('one','20261025T090000Z'),event('one','20261025T090000Z')]),now).length,1);
 assert.deepEqual(upcoming(feed([]),now),[]);
});
