import pg from 'pg';
import ca from './database-ca.mjs';
import {DateTime} from 'luxon';
import {randomUUID,randomBytes,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
export const POLICY='If you can no longer attend, please let us know as soon as possible. Cancellations made at least 48 hours before the event are eligible for a refund. After that time, contributions are non-refundable, but you may transfer your place to another person. If we cancel the event, you will receive a full refund.';
export const TEST_REF='eicpgkmajosuhrqtrgrf';
export const uuid=randomUUID, token=()=>randomBytes(32).toString('base64url'), now=()=>new Date().toISOString(), hash=s=>createHash('sha256').update(String(s)).digest('hex');
export function fail(message,status=400){throw Object.assign(new Error(message),{status});}
export function check(condition,message,status=400){if(!condition)fail(message,status);}
export function origin(){const url=new URL(process.env.SITE_URL);check(url.protocol==='https:'&&url.hostname.endsWith('.netlify.app'),'Test site URL is not configured.',503);return url.origin;}
export function eventOrigin(){return origin()+'/event-tool';}
export function address(s){s=String(s||'').trim().toLowerCase();check(s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),'Enter a valid email.');return s;}
export function allowed(s){return (process.env.EMAIL_TEST_ALLOWLIST||'').split(',').map(s=>s.trim().toLowerCase()).includes(s.toLowerCase());}
export function text(p,k,max=500,required=false){const v=String(p[k]??'').trim();check(v.length<=max&&(!required||v),'Check '+k.replaceAll('_',' '));return v;}
export function integer(v,min,max){const n=Number(v);check(Number.isInteger(n)&&n>=min&&n<=max,'Invalid numeric value.');return n;}
export function cents(v){const s=String(v);check(/^\d+(\.\d{1,2})?$/.test(s),'Use an amount with up to two decimal places.');return integer(Math.round(Number(s)*100),0,1000000);}
export function instant(value,zone){const d=DateTime.fromISO(value,{zone});check(d.isValid,'Use a valid date and timezone.');return d.toMillis();}
export function eligible(e,at=Date.now()){return instant(e.starts,e.zone)-at>=48*3600000;}
export function pw(password,salt=randomBytes(16).toString('hex')){check(typeof password==='string'&&password.length>=12&&password.length<=1024,'Use a password of 12–1024 characters.');return salt+':'+scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');}
export function verify(password,stored){if(typeof password!=='string'||password.length<1||password.length>1024)return false;const salt=stored.split(':')[0];const a=Buffer.from(salt+':'+scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex')),b=Buffer.from(stored);return a.length===b.length&&timingSafeEqual(a,b);}
export function cookie(req,name){return (req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';}
export function sessionCookie(name,value,days){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${value?Math.floor(days*86400):0}`;}
export async function transaction(fn){
 check(process.env.CG_TEST_PROJECT===TEST_REF&&process.env.PGUSER==='event_tool_app.'+TEST_REF&&process.env.PGHOST==='aws-0-eu-west-1.pooler.supabase.com','Test database guard failed.',503);
 const client=new pg.Client({host:process.env.PGHOST,port:6543,user:process.env.PGUSER,password:process.env.PGPASSWORD,database:'postgres',ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:8000,query_timeout:20000});
 await client.connect();
 let db={q:async(sql,args=[])=>{let n=0;return (await client.query(sql.replace(/\?/g,()=>'$'+(++n)),args)).rows;},exec:async(sql,args=[])=>{let n=0;return client.query(sql.replace(/\?/g,()=>'$'+(++n)),args);}};
 db.one=async(sql,args=[]) => (await db.q(sql,args))[0];
 try{await client.query('BEGIN');await client.query('SET LOCAL search_path TO event_tool');await client.query("SET LOCAL statement_timeout='20s'");await client.query('SELECT pg_advisory_xact_lock(80302026)');const result=await fn(db);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{await client.end();}
}
export async function settings(db){return {...JSON.parse((await db.one('SELECT value FROM calendar_settings WHERE id=1')).value),refund_policy:POLICY};}
export async function queueEmail(db,to,subject,body,automatic=false){const status=automatic&&allowed(to)?'queued':'preview';await db.exec('INSERT INTO emails(id,recipient,subject,body,delivery_status,delivery_next,delivery_created) VALUES(?,?,?,?,?,?,?)',[uuid(),to,subject,body,status,now(),now()]);}
export const refundMessage=status=>({queued:'Your full refund is queued.',retry:'Your refund is being retried.',pending:'Stripe is processing your refund.',succeeded:'Your full refund was processed.',not_eligible:'This contribution is non-refundable because fewer than 48 hours remained.',review:'Your refund needs host attention.',failed:'Your refund needs host attention.',requires_action:'Your refund needs host attention.',canceled:'Your refund needs host attention.'}[status]||'');
export async function notify(db,b,e,subject){await queueEmail(db,b.email,subject+': '+e.title,`Hello ${b.name},\n\nYour registration status: ${b.status}.\n${e.starts} (${e.zone})\n${b.status==='confirmed'?e.location+'\n'+e.confirmation_message:''}\n${refundMessage(b.refund_status)}\n\nManage your booking: ${eventOrigin()}/?booking=${encodeURIComponent(b.id)}\n\nTEST ONLY — no real money is charged.`,true);}
export async function expire(db){await db.exec("UPDATE bookings SET status='expired' WHERE status='pending' AND created < ? AND NOT EXISTS (SELECT 1 FROM stripe_checkouts s WHERE s.booking_id=bookings.id)",[new Date(Date.now()-600000).toISOString()]);}
