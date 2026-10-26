import test from 'node:test';
import assert from 'node:assert/strict';
import {coverURL,eventCover,eventJSON} from '../lib/event-media.mjs';
import {eventSummaries} from '../lib/event-summaries.mjs';
import {saveEvent} from '../lib/events.mjs';
import {state} from '../lib/dashboard.mjs';
const cover='data:image/png;base64,aGVsbG8=';
const req=new Request('https://example.com/api/event-cover');
test('covers are separate binary responses, versioned and private drafts are denied',async()=>{
 const e={id:'example',cover,published:1,cancelled:0,visibility:'public',host_ids:'[]'};
 const url=new URL(coverURL(e.id,e.cover),'https://example.com');
 const db={one:async sql=>sql.startsWith('SELECT id,cover')?e:null};
 const response=await eventCover(db,req,url);
 assert.equal(await response.text(),'hello');assert.equal(response.headers.get('Content-Type'),'image/png');
 assert.match(response.headers.get('Cache-Control'),/max-age=300/);
 e.published=0;await assert.rejects(()=>eventCover(db,req,url),e=>e.status===404);
 e.published=1;url.searchParams.set('v','stale');await assert.rejects(()=>eventCover(db,req,url),e=>e.status===404);
 assert.notEqual(coverURL('example',cover),coverURL('example',cover+'A'));
 assert.match(eventJSON,/to_jsonb\(e\) - 'cover'/);
});
test('public summaries are bounded and exclude private fields and inline images',async()=>{
 const calls=[];const db={q:async(sql,args)=>{calls.push({sql,args});return sql.includes('DISTINCT')?[{date:'2099-01-01'}]:[{id:'a'},{id:'b'},{id:'c'}];}};
 const result=await eventSummaries(db,new URL('https://example.com?limit=2&dates=1&date=2099-01-01'));
 assert.equal(result.events.length,2);assert.equal(result.next_offset,2);assert.deepEqual(result.dates,['2099-01-01']);
 assert.match(calls[0].sql,/visibility='public'/);assert.match(calls[0].sql,/location_type='online' THEN ''/);
 assert.doesNotMatch(calls[0].sql,/SELECT \*|description_html|confirmation_message/);
 assert.deepEqual(calls[0].args,['2099-01-01',3,0]);
 await assert.rejects(()=>eventSummaries(db,new URL('https://example.com?limit=999')));
});
test('public state scopes bookings, aggregates counts once and hides online links',async()=>{
 const calls=[];
 const db={one:async()=>null,q:async(sql,args)=>{
   calls.push({sql,args});
   if(sql.includes('AS event'))return [{event:{id:'a',starts:'2099-01-01T10:00',zone:'UTC',location_type:'online',location:'secret',confirmation_message:'private',cover:'/api/event-cover?id=a'}}];
   if(sql.includes('GROUP BY'))return [{event_id:'a',n:'3'}];
   return [];
 }};
 const result=await state(db,new Request('https://example.com'),true);
 assert.equal(result.events[0].location,'');assert.equal(result.events[0].confirmation_message,'');assert.equal(result.events[0].reserved_count,3);
 assert.equal(calls.filter(c=>c.sql.includes('GROUP BY')).length,1);
 assert.equal(calls.some(c=>c.sql.startsWith('SELECT * FROM bookings')),false);
 assert.equal(calls.some(c=>c.sql==='SELECT * FROM bookings'),false);
});

test('editing an event retains its existing cover reference without accepting arbitrary URLs',async()=>{
 const old={id:'example',cover};let saved;
 const db={one:async()=>old,q:async sql=>sql.includes('public.counselors')?[{id:'host',name:'Host'}]:[],exec:async(sql,args)=>{if(sql.startsWith('INSERT INTO events'))saved=args;}};
 const input={id:'example',title:'Meditation',starts:'2099-01-01T10:00',zone:'UTC',capacity:10,price:0,host_ids:['host'],location:'A studio',cover:coverURL(old.id,cover)};
 await saveEvent(db,input);assert.ok(saved.includes(cover));assert.ok(!saved.includes(input.cover));
 await assert.rejects(()=>saveEvent(db,{...input,cover:'https://untrusted.example/image.png'}));
});
