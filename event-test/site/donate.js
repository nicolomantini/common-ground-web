const form=document.getElementById('donation-form'),amount=document.getElementById('donation-amount'),submit=document.getElementById('donation-submit'),status=document.getElementById('donation-status');
let attempt=null;
const valueLabel=document.getElementById('donation-value');
const currency=new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR',maximumFractionDigits:0});
// Position zero preserves the €1 minimum; all other positions are €5 steps.
function selectedAmount(){return Number(amount.value)===0?1:Number(amount.value)*5;}
function updateAmount(){valueLabel.textContent=currency.format(selectedAmount());amount.setAttribute('aria-valuetext',valueLabel.textContent);}
amount.addEventListener('input',updateAmount);
updateAmount();
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!form.reportValidity()||submit.disabled)return;
 const value=String(selectedAmount());
 if(!attempt||attempt.amount!==value)attempt={amount:value,request_id:crypto.randomUUID()};
 submit.disabled=true;status.textContent='Opening secure checkout…';
 try{
  const response=await fetch('/.netlify/functions/donate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt)}),data=await response.json();
  if(!response.ok)throw Error(data.error||'Checkout is unavailable.');
  const url=new URL(data.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw Error('Checkout is unavailable.');
  location.assign(url.href);
 }catch(error){status.textContent=error.message;submit.disabled=false;}
});
const params=new URLSearchParams(location.search);
if(params.has('cancelled'))status.textContent='Checkout was cancelled. You can choose an amount and try again whenever you like.';
if(params.has('session_id')){
 form.hidden=true;status.textContent='Checking your contribution…';
 fetch('/.netlify/functions/donate?session_id='+encodeURIComponent(params.get('session_id'))).then(async response=>{
  const data=await response.json();if(!response.ok)throw Error(data.error);
  status.textContent=data.paid?'Thank you! Your test contribution of '+new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR'}).format(data.amount/100)+' was successful. No real money was charged.':'Your payment has not been confirmed yet. Refresh this page to check again.';
 }).catch(()=>{status.textContent='We couldn’t verify this contribution yet. Refresh to try again.';});
}
