import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {register} from '../lib/events.mjs';
test('server accepts five-euro contributions and rejects arbitrary amounts',async()=>{
 process.env.SITE_URL='https://common-ground-test.netlify.app';
 const event={id:'event',published:1,registration_open:1,starts:'2099-01-01T12:00',zone:'Europe/Zurich',pricing_mode:'donation',donation_min:0,donation_max:3000,capacity:20,tickets:'[]',questions:'[]',price:1500};
 let saved;const db={one:async sql=>sql.startsWith('SELECT * FROM events')?event:sql.includes('count(*)')?{n:0}:sql.startsWith('SELECT * FROM bookings WHERE id=')?saved:undefined,exec:async(sql,args)=>{if(sql.startsWith('INSERT INTO bookings'))saved={id:args[0],event_id:args[1],name:args[2],email:args[3],status:args[4],amount:args[8]};}};
 for(const amount of [0,5,10,15,20,25,30])assert.equal((await register(db,{event_id:'event',name:'Test',email:'test@example.invalid',contribution:amount})).amount,amount*100);
 for(const amount of [0.5,1,7,12.34,29,35])await assert.rejects(register(db,{event_id:'event',name:'Test',email:'test@example.invalid',contribution:amount}),/€5 steps/);
});
test('slider and typed entry share the same five-euro rule',async()=>{
 const source=await readFile(new URL('../../local-events/event-settings.js',import.meta.url),'utf8');const fn=source.slice(source.indexOf('function showContribution('),source.indexOf('\nrefresh().then'));
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{style:{setProperty(){}},setAttribute(){},setCustomValidity(v){this.error=v;},replaceChildren(){},append(){}});return nodes.get(id);};
 const ctx={$ ,money:n=>'EUR '+n/100,button:()=>({})};vm.createContext(ctx);vm.runInContext(fn+';showContribution({pricing_mode:"donation",donation_min:0,donation_suggested:1500,donation_max:3000});',ctx);
 assert.equal($('contribution-slider').step,5);assert.equal($('contribution-amount').step,5);
 $('contribution-amount').value='7';$('contribution-amount').oninput();assert.match($('contribution-amount').error,/€5 steps/);
 $('contribution-slider').value='20';$('contribution-slider').oninput();assert.equal($('contribution-amount').value,'20');assert.equal($('contribution-amount').error,'');
});
