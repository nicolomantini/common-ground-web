import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import handler,{donationPayload,donationStatus} from '../functions/donate.mjs';
const request_id='12345678-1234-4123-8123-123456789abc',site='https://common-ground-test.netlify.app';
test('donations validate amounts server-side and never create bookings',()=>{
 const payload=donationPayload({amount:'12.50',request_id},site);
 assert.equal(payload.line_items[0].price_data.unit_amount,1250);
 assert.equal(payload.line_items[0].price_data.currency,'eur');
 assert.equal(payload.metadata.purpose,'common-ground-donation');
 assert.ok(!payload.metadata.booking_id);
 assert.equal(payload.success_url,site+'/donate/?session_id={CHECKOUT_SESSION_ID}');
 for(const amount of ['0','-1','0.99','1000.01','NaN','1.001','1e2'])assert.throws(()=>donationPayload({amount,request_id},site));
 assert.throws(()=>donationPayload({amount:'10',request_id:'bad'},site));
});
test('return confirmation requires a paid test donation',()=>{
 const session={livemode:false,payment_status:'paid',currency:'eur',amount_total:1000,metadata:{purpose:'common-ground-donation'}};
 assert.equal(donationStatus(session).paid,true);
 assert.equal(donationStatus({...session,payment_status:'unpaid'}).paid,false);
 assert.throws(()=>donationStatus({...session,livemode:true}));
 assert.throws(()=>donationStatus({...session,metadata:{booking_id:'other'}}));
});
test('requests from other origins and invalid references are rejected',async()=>{
 process.env.SITE_URL=site;
 assert.equal((await handler(new Request(site+'/.netlify/functions/donate',{method:'POST',headers:{origin:'https://example.com','Content-Type':'application/json'},body:'{}'}))).status,403);
 assert.equal((await handler(new Request(site+'/.netlify/functions/donate?session_id=cs_live_123'))).status,400);
});
test('test build includes donation page and header link without changing root homepage',async()=>{
 const home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(home,/href="\/donate\/" class="donate-nav">Donate/);
 assert.doesNotMatch(await readFile(new URL('../../index.html',import.meta.url),'utf8'),/donate-nav/);
 assert.match(await readFile(new URL('../public/donate/index.html',import.meta.url),'utf8'),/No real money will be charged/);
});

test('slider displays and submits euro amounts rather than slider positions',async()=>{
 const {runInNewContext}=await import('node:vm');
 const nodes=new Map();
 const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'20',listeners:{},attrs:{},addEventListener(k,fn){this.listeners[k]=fn;},setAttribute(k,v){this.attrs[k]=v;},reportValidity(){return true;}});return nodes.get(id);};
 let sent;
 runInNewContext(await readFile(new URL('../site/donate.js',import.meta.url),'utf8'),{document:{getElementById:get},Intl,URL,URLSearchParams,crypto:{randomUUID:()=>request_id},location:{search:'',assign(){}},fetch:async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({url:'https://checkout.stripe.com/c/pay/test'})};}});
 assert.equal(get('donation-value').textContent,'€100');
 for(const [position,display] of [['0','€1'],['1','€5'],['2','€10'],['20','€100'],['200','€1,000']]){
  get('donation-amount').value=position;get('donation-amount').listeners.input();
  assert.equal(get('donation-value').textContent,display);
  assert.equal(get('donation-amount').attrs['aria-valuetext'],display);
 }
 await get('donation-form').listeners.submit({preventDefault(){}});
 assert.equal(sent.amount,'1000');
});
