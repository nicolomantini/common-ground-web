import {stripe} from '../lib/billing.mjs';
import {check,cents,origin} from '../lib/core.mjs';

export function donationPayload(input,site) {
  const amount=cents(input.amount);
  check(amount>=100&&amount<=100000,'Choose an amount between €1 and €1,000.');
  check(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.request_id||''),'Please reload and try again.');
  return {mode:'payment',payment_method_types:['card'],
    line_items:[{quantity:1,price_data:{currency:'eur',unit_amount:amount,product_data:{name:'Support Common Ground',description:'A one-time contribution to Common Ground.'}}}],
    metadata:{purpose:'common-ground-donation'},payment_intent_data:{metadata:{purpose:'common-ground-donation'}},
    success_url:site+'/donate/?session_id={CHECKOUT_SESSION_ID}',cancel_url:site+'/donate/?cancelled=1'};
}
export function donationStatus(session) {
  check(session.livemode===false&&session.metadata?.purpose==='common-ground-donation'&&session.currency==='eur','Donation checkout not found.',404);
  return {paid:session.payment_status==='paid',amount:session.amount_total,currency:session.currency};
}
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export default async function handler(req) {
  try {
    const site=origin();
    if(req.method==='GET') {
      const id=new URL(req.url).searchParams.get('session_id');
      check(/^cs_test_[a-zA-Z0-9]+$/.test(id||''),'Invalid checkout reference.');
      return reply(donationStatus(await stripe().checkout.sessions.retrieve(id)));
    }
    check(req.method==='POST','Method not allowed.',405);
    check(req.headers.get('origin')===site,'Open the Common Ground test website to continue.',403);
    check(req.headers.get('content-type')?.includes('application/json'),'JSON is required.',415);
    const raw=await req.text();check(raw.length<2048,'Request too large.',413);
    let input;try{input=JSON.parse(raw);}catch{check(false,'Invalid request.');}
    check(input&&typeof input==='object'&&!Array.isArray(input),'Invalid request.');
    const payload=donationPayload(input,site);
    const session=await stripe().checkout.sessions.create(payload,{idempotencyKey:'cg-donation-'+input.request_id});
    check(session.livemode===false&&session.url?.startsWith('https://checkout.stripe.com/'),'Checkout unavailable.',503);
    return reply({url:session.url});
  }catch(error){return reply({error:error.status?error.message:'Checkout is temporarily unavailable. Please try again.'},error.status||503);}
}
