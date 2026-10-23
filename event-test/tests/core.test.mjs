import {scryptSync} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {cents,eligible,instant,pw,verify,sessionCookie,origin} from '../lib/core.mjs';
import {manages,authorize} from '../lib/auth.mjs';
import {transition} from '../lib/events.mjs';
import {webhook} from '../lib/billing.mjs';
test('currency rejects fractional cents and invalid money',()=>{assert.equal(cents('12.35'),1235);for(const v of ['1.001','-1','NaN','Infinity','1e2'])assert.throws(()=>cents(v));});
test('48-hour refund cutoff uses elapsed time across DST',()=>{const e={starts:'2026-10-26T10:00',zone:'Europe/Zurich'},cutoff=instant(e.starts,e.zone)-48*3600000;assert.equal(eligible(e,cutoff),true);assert.equal(eligible(e,cutoff+1),false);assert.equal(new Date(cutoff).toISOString(),'2026-10-24T09:00:00.000Z');});
test('password verification and secure session cookie',()=>{const h=pw('test-password-123');assert.ok(verify('test-password-123',h));assert.ok(!verify('wrong-password-123',h));assert.match(sessionCookie('cg_guest','abc',7),/HttpOnly; Secure; SameSite=Strict/);});
test('only assigned hosts and administrators manage events',()=>{const e={host_ids:'["host-one"]'};assert.ok(manages({admin:1},e));assert.ok(manages({practitioner_id:'host-one'},e));assert.ok(!manages({practitioner_id:'host-two'},e));assert.ok(!manages(null,e));});
test('manual payment confirmation is not an accepted guest action',async()=>{await assert.rejects(transition({one:async()=>({cancelled:0})},{event_id:'event'},'pay'),/Unknown guest action/);});
test('test site origin refuses production domain',()=>{const old=process.env.SITE_URL;process.env.SITE_URL='https://common-ground.space';assert.throws(origin);process.env.SITE_URL=old;});
test('unsigned payment callbacks cannot change bookings',async()=>{process.env.STRIPE_SECRET_KEY='sk_test_fake';process.env.STRIPE_WEBHOOK_SECRET='whsec_test';await assert.rejects(webhook(new Request('https://example.netlify.app/api/stripe-webhook',{method:'POST',body:'{}'})),/Invalid Stripe webhook signature/);});

test('existing shorter passwords authenticate without relaxing new-password rules',()=>{const salt='test-salt';const h=salt+':'+scryptSync('short-pass',salt,64,{N:16384,r:8,p:1}).toString('hex');assert.ok(verify('short-pass',h));assert.ok(!verify('wrong',h));assert.throws(()=>pw('short-pass'));});

test('ordinary practitioners can create events with themselves as host',async()=>{
 const account={email:'member@example.com',admin:0,practitioner_id:'member-id',active:1};
 const db={one:async sql=>sql.includes('host_accounts')?account:undefined};
 const req=new Request('https://example.netlify.app/api/event');
 await authorize(db,req,'event',{host_ids:['member-id','co-host']});
 await assert.rejects(authorize(db,req,'event',{host_ids:['co-host']}),/Keep yourself/);
 await assert.rejects(authorize(db,req,'calendar-settings',{}),/Administrator/);
 await assert.rejects(authorize({one:async()=>undefined},req,'event',{host_ids:['member-id']}),/Sign in/);
});
