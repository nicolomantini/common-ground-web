const test=require('node:test');
const assert=require('node:assert/strict');
const {handler,donationPayload,donationStatus}=require('../netlify/functions/donate.cjs');
const request_id='12345678-1234-4123-8123-123456789abc';
const input={amount:'100',request_id};
const event={httpMethod:'POST',headers:{origin:'https://common-ground.space','content-type':'application/json'},body:JSON.stringify(input)};
test('production payload validates slider amounts and keeps return URLs fixed',()=>{
 for(const amount of ['1','5','100','1000'])assert.equal(donationPayload({...input,amount}).get('line_items[0][price_data][unit_amount]'),String(Number(amount)*100));
 for(const amount of ['0','-1','1.01','6','1005','NaN','1e2'])assert.throws(()=>donationPayload({...input,amount}));
 assert.throws(()=>donationPayload({...input,request_id:'bad'}));
 const payload=donationPayload(input);assert.equal(payload.get('success_url'),'https://common-ground.space/donate/?session_id={CHECKOUT_SESSION_ID}');assert.equal(payload.get('submit_type'),'donate');
});
test('branding applies only to this checkout without overriding payment descriptors',()=>{
 const payload=donationPayload(input);
 assert.equal(payload.get('branding_settings[display_name]'),'Common Ground');
 assert.equal(payload.get('branding_settings[background_color]'),'#FEEADD');
 assert.equal(payload.get('branding_settings[button_color]'),'#9E5D54');
 assert.equal(payload.get('branding_settings[icon][url]'),'https://common-ground.space/images/brand/common-ground-luma-icon.png');
 assert.equal(payload.has('payment_intent_data[statement_descriptor_suffix]'),false);
});
test('success requires a live, paid donation session',()=>{
 const s={livemode:true,mode:'payment',payment_status:'paid',currency:'eur',amount_total:10000,metadata:{purpose:'common-ground-donation'}};
 assert.equal(donationStatus(s).paid,true);assert.equal(donationStatus({...s,payment_status:'unpaid'}).paid,false);
 for(const change of [{livemode:false},{currency:'usd'},{metadata:{}},{amount_total:null}])assert.throws(()=>donationStatus({...s,...change}));
});
test('handler rejects foreign origins, test keys and untrusted redirects',async()=>{
 const oldKey=process.env.STRIPE_SECRET_KEY,oldFetch=global.fetch;
 try{
  assert.equal((await handler({...event,headers:{...event.headers,origin:'https://evil.example'}})).statusCode,403);
  process.env.STRIPE_SECRET_KEY='sk_test_fixture';assert.equal((await handler(event)).statusCode,503);
  process.env.STRIPE_SECRET_KEY='sk_live_fixture';let call;
  global.fetch=async(url,options)=>{call={url,options};return {ok:true,json:async()=>({livemode:true,url:'https://checkout.stripe.com/c/pay/example'})};};
  const response=await handler(event);assert.equal(response.statusCode,200);assert.equal(call.options.headers['Idempotency-Key'],'cg-live-donation-'+request_id);
  assert.equal(new URLSearchParams(call.options.body).get('line_items[0][price_data][unit_amount]'),'10000');
  global.fetch=async()=>({ok:true,json:async()=>({livemode:true,url:'https://evil.example/'})});assert.equal((await handler(event)).statusCode,503);
  assert.equal((await handler({httpMethod:'GET',queryStringParameters:{session_id:'cs_test_123'}})).statusCode,400);
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=oldKey;}
});
