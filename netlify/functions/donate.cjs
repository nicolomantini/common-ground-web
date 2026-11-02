const SITE='https://common-ground.space';
const check=(condition,message,status=400)=>{if(!condition)throw Object.assign(new Error(message),{status});};
function donationPayload(input) {
  check(input&&typeof input==='object'&&!Array.isArray(input),'Invalid request.');
  check(/^\d+(\.\d{1,2})?$/.test(String(input.amount)),'Choose a valid contribution.');
  const amount=Math.round(Number(input.amount)*100);
  check(Number.isSafeInteger(amount)&&amount>=100&&amount<=100000,'Choose an amount between €1 and €1,000.');
  check(amount===100||amount%500===0,'Choose €1 or an amount in €5 steps.');
  check(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.request_id||''),'Please reload and try again.');
  return new URLSearchParams({mode:'payment',submit_type:'donate','payment_method_types[0]':'card',
    'branding_settings[display_name]':'Common Ground',
    'branding_settings[background_color]':'#FEEADD','branding_settings[button_color]':'#9E5D54',
    'branding_settings[border_style]':'rounded',
    'branding_settings[icon][type]':'url',
    'branding_settings[icon][url]':SITE+'/images/brand/common-ground-luma-icon.png',
    'line_items[0][quantity]':'1','line_items[0][price_data][currency]':'eur','line_items[0][price_data][unit_amount]':String(amount),
    'line_items[0][price_data][product_data][name]':'Support Common Ground',
    'line_items[0][price_data][product_data][description]':'A one-time contribution to Common Ground.',
    'metadata[purpose]':'common-ground-donation','payment_intent_data[metadata][purpose]':'common-ground-donation',
    'payment_intent_data[statement_descriptor_suffix]':'COMMON GROUND',
    success_url:SITE+'/donate/?session_id={CHECKOUT_SESSION_ID}',cancel_url:SITE+'/donate/?cancelled=1'});
}
function donationStatus(s) {
  check(s.livemode===true&&s.mode==='payment'&&s.metadata?.purpose==='common-ground-donation'&&s.currency==='eur','Donation checkout not found.',404);
  check(Number.isSafeInteger(s.amount_total)&&s.amount_total>=100&&s.amount_total<=100000,'Donation checkout not found.',404);
  return {paid:s.payment_status==='paid',amount:s.amount_total,currency:s.currency};
}
async function stripe(path,body,requestId) {
  const key=process.env.STRIPE_SECRET_KEY;
  check(key?.startsWith('sk_live_'),'Donations are not available yet. Please try again later.',503);
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions'+path,{
    method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,'Stripe-Version':'2025-02-24.acacia',
      ...(body?{'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'cg-live-donation-'+requestId}:{})},
    ...(body?{body:body.toString()}:{}),signal:AbortSignal.timeout(10000)});
  check(response.ok,'Checkout is temporarily unavailable. Please try again.',503);
  return response.json();
}
const reply=(body,statusCode=200)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)});
async function handler(event) {
  try {
    if(event.httpMethod==='GET') {
      const id=event.queryStringParameters?.session_id;
      check(/^cs_live_[a-zA-Z0-9]+$/.test(id||''),'Invalid checkout reference.');
      return reply(donationStatus(await stripe('/'+encodeURIComponent(id))));
    }
    check(event.httpMethod==='POST','Method not allowed.',405);
    check(event.headers?.origin===SITE,'Open Common Ground to continue.',403);
    check(event.headers?.['content-type']?.includes('application/json'),'JSON is required.',415);
    check(!event.isBase64Encoded&&typeof event.body==='string'&&event.body.length<2048,'Invalid request.',413);
    let input;try{input=JSON.parse(event.body);}catch{check(false,'Invalid request.');}
    const payload=donationPayload(input);
    const session=await stripe('',payload,input.request_id);
    check(session.livemode===true,'Checkout unavailable.',503);
    let url;try{url=new URL(session.url);}catch{}
    check(url?.protocol==='https:'&&url.hostname==='checkout.stripe.com'&&!url.username&&!url.password,'Checkout unavailable.',503);
    return reply({url:url.href});
  }catch(error){return reply({error:error.status?error.message:'Checkout is temporarily unavailable. Please try again.'},error.status||503);}
}
module.exports={handler,donationPayload,donationStatus};
