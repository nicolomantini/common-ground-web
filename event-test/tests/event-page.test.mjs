import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('calendar requests paginated summaries, preserves dates and switches periods',async()=>{
 class Element{constructor(){this.children=[];this.attrs={};}append(...nodes){this.children.push(...nodes);}after(node){this.afterNode=node;}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this.attrs[k]=v;}}
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 const sample=(id,starts,has_started)=>({id,starts,has_started,title:id,zone:'Europe/Zurich',host_ids:'[]',location_type:'online'});
 const requests=[];
 const source=await readFile(new URL('../site/events.js',import.meta.url),'utf8');
 runInNewContext(source,{document:{getElementById:get,createElement:()=>new Element()},Date,Set,JSON,URLSearchParams,encodeURIComponent,fetch:async url=>{
  requests.push(url);const params=new URL(url,'https://example.com').searchParams;
  const past=params.get('period')==='past',offset=params.get('offset');
  return {ok:true,json:async()=>url.includes('practitioners')?{practitioners:[]}:{events:params.has('date')?[]:[sample(offset==='50'?'second':past?'past':'future',past?'2020-10-20T19:00':'2099-10-30T19:00',past)],dates:['2099-10-30'],next_offset:offset==='50'?null:50}};
 }});
 await settle();assert.equal(get('event-list').children.length,1);
 const more=get('event-list').afterNode;assert.equal(more.hidden,false);
 await more.onclick();await settle();assert.equal(get('event-list').children[0].children.length,3);assert.equal(more.hidden,true);
 get('past').onclick();await settle();assert.equal(get('past').attrs['aria-pressed'],'true');assert.ok(requests.some(r=>r.includes('period=past')));
 get('calendar-days').children[0].onclick();await settle();assert.equal(get('event-list').children.length,0);assert.equal(get('clear-date').hidden,false);
 get('clear-date').onclick();await settle();assert.equal(get('event-list').children.length,1);
 const label=get('month-label').textContent;get('next-month').onclick();assert.notEqual(get('month-label').textContent,label);
 assert.ok(requests.every(r=>!r.includes('public-state')));
});
