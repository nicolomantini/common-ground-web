import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
test('calendar filters public events by period and selected date',async()=>{
 class Element{constructor(){this.children=[];this.attrs={};}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this.attrs[k]=v;}}
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 const sample=(id,starts,has_started,visibility='public')=>({id,starts,has_started,visibility,published:1,cancelled:0,title:id,zone:'Europe/Zurich',host_ids:'[]',location_type:'online'});
 const data=[sample('future','2099-10-30T19:00',false),sample('past','2020-10-20T19:00',true),sample('private','2099-10-30T19:00',false,'unlisted')];
 const source=await readFile(new URL('../site/events.js',import.meta.url),'utf8');
 await runInNewContext('(async()=>{'+source+'})()', {document:{getElementById:get,createElement:()=>new Element()},Date,Set,JSON,encodeURIComponent,fetch:async url=>({ok:true,json:async()=>url.includes('practitioners')?{practitioners:[]}:{events:data}})});
 assert.equal(get('event-list').children.length,1);
 assert.equal(get('event-list').children[0].children.length,2);
 get('past').onclick();assert.equal(get('past').attrs['aria-pressed'],'true');assert.equal(get('event-list').children.length,1);
 get('calendar-days').children[0].onclick();assert.equal(get('event-list').children.length,0);assert.equal(get('clear-date').hidden,false);
 get('clear-date').onclick();assert.equal(get('event-list').children.length,1);
 const label=get('month-label').textContent;get('next-month').onclick();assert.notEqual(get('month-label').textContent,label);
});
