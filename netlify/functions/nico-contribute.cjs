const SITE = 'https://nicolomantini.com';
const PURPOSE = 'nico-work-contribution';
const check = (condition, message, status = 400) => {
  if (!condition) throw Object.assign(new Error(message), { status });
};
const translations = {
  en: { name: 'Support Nico\'s work', description: 'For writing, resources, or a gathering you have attended.' },
  it: { name: 'Sostieni il lavoro di Nico', description: 'Per scritti, risorse o un incontro a cui hai partecipato.' }
};

function contributionPayload(input) {
  check(input && typeof input === 'object' && !Array.isArray(input), 'Invalid request.');
  check(/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(String(input.amount)), 'Choose a valid amount.');
  const [whole, fraction = ''] = String(input.amount).split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  check(cents >= 50 && cents <= 99999999, 'Choose an amount of at least €0.50.');
  check(Object.hasOwn(translations, input.lang), 'Choose a valid language.');
  check(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.request_id || ''), 'Please reload and try again.');
  const copy = translations[input.lang];
  const returnPage = SITE + '/contribute/?lang=' + input.lang;
  return new URLSearchParams({
    mode: 'payment', submit_type: 'pay', locale: input.lang,
    'payment_method_types[0]': 'card',
    'branding_settings[display_name]': 'Nicolò Mantini',
    'branding_settings[background_color]': '#EFEDE6',
    'branding_settings[button_color]': '#20282B',
    'branding_settings[border_style]': 'rounded',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(cents),
    'line_items[0][price_data][product_data][name]': copy.name,
    'line_items[0][price_data][product_data][description]': copy.description,
    'metadata[purpose]': PURPOSE,
    'payment_intent_data[metadata][purpose]': PURPOSE,
    'payment_intent_data[statement_descriptor_suffix]': 'NICO MANTINI',
    success_url: returnPage + '&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: returnPage + '&cancelled=1'
  });
}

function contributionStatus(session) {
  check(session.livemode === true && session.mode === 'payment' && session.metadata?.purpose === PURPOSE && session.currency === 'eur', 'Checkout not found.', 404);
  check(Number.isSafeInteger(session.amount_total) && session.amount_total >= 50 && session.amount_total <= 99999999, 'Checkout not found.', 404);
  return { paid: session.payment_status === 'paid', amount: session.amount_total, currency: 'eur' };
}

async function stripe(path, body, requestId) {
  const key = process.env.STRIPE_SECRET_KEY;
  check(/^(?:sk|rk)_live_/.test(key || ''), 'Checkout is unavailable right now.', 503);
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + key,
      'Stripe-Version': '2025-02-24.acacia',
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': 'nico-work-' + requestId } : {})
    },
    ...(body ? { body: body.toString() } : {}),
    signal: AbortSignal.timeout(10000)
  });
  check(response.ok, 'Checkout is temporarily unavailable. Please try again.', 503);
  return response.json();
}

const reply = (body, statusCode = 200) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': SITE, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' },
  body: JSON.stringify(body)
});

async function handler(event) {
  try {
    check(event.headers?.origin === SITE, 'Open the website to continue.', 403);
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: reply({}).headers, body: '' };
    if (event.httpMethod === 'GET') {
      const id = event.queryStringParameters?.session_id;
      check(/^cs_live_[a-zA-Z0-9]+$/.test(id || ''), 'Invalid checkout reference.');
      return reply(contributionStatus(await stripe('/' + encodeURIComponent(id))));
    }
    check(event.httpMethod === 'POST', 'Method not allowed.', 405);
    check(event.headers?.['content-type']?.includes('application/json'), 'JSON is required.', 415);
    check(!event.isBase64Encoded && typeof event.body === 'string' && event.body.length < 2048, 'Invalid request.', 413);
    let input;
    try { input = JSON.parse(event.body); } catch { check(false, 'Invalid request.'); }
    const payload = contributionPayload(input);
    const session = await stripe('', payload, input.request_id);
    check(session.livemode === true, 'Checkout unavailable.', 503);
    let url;
    try { url = new URL(session.url); } catch {}
    check(url?.protocol === 'https:' && url.hostname === 'checkout.stripe.com' && !url.username && !url.password, 'Checkout unavailable.', 503);
    return reply({ url: url.href });
  } catch (error) {
    return reply({ error: error.status ? error.message : 'Checkout is temporarily unavailable. Please try again.' }, error.status || 503);
  }
}
module.exports = { handler, contributionPayload, contributionStatus };
