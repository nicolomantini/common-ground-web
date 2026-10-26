import {eventJSON} from './event-media.mjs';
import {check,text,integer,uuid,now,settings,queueEmail,address,origin,eventOrigin,instant,POLICY} from './core.mjs';
import {host,guest,manages} from './auth.mjs';
export async function usage(db){const r=await db.one("SELECT count(*) FILTER (WHERE substr(sent_at,1,10)=? OR substr(delivery_first,1,10)=?) AS daily,count(*) FILTER (WHERE substr(sent_at,1,7)=? OR substr(delivery_first,1,7)=?) AS monthly FROM emails",[now().slice(0,10),now().slice(0,10),now().slice(0,7),now().slice(0,7)]);return {daily:Number(r.daily),monthly:Number(r.monthly)};}
export async function state(db,req,isPublic,eventId) {
 const a=isPublic?null:await host(db,req);
 check(isPublic||a,'Sign in as a host.',401);
 const email=isPublic?await guest(db,req,false):null;
 let scope=isPublic
   ? "((e.published=1 AND e.cancelled=0 AND (e.visibility='public' OR e.id=?)) OR EXISTS (SELECT 1 FROM bookings b WHERE b.event_id=e.id AND lower(b.email)=?))"
   : a.admin?'TRUE':"e.host_ids::jsonb @> ?::jsonb";
 const args=isPublic?[eventId||'',email||'']:a.admin?[]:[JSON.stringify([a.practitioner_id])];
 if(isPublic&&eventId){scope+=' AND e.id=?';args.push(eventId);}
 const events=(await db.q(`SELECT ${eventJSON} FROM events e WHERE ${scope}`,args)).map(r=>r.event);
 const ids=events.map(e=>e.id);
 const bookings=isPublic
   ? email?await db.q('SELECT * FROM bookings WHERE lower(email)=? AND event_id=ANY(?::text[])',[email,ids]):[]
   : await db.q('SELECT * FROM bookings WHERE event_id=ANY(?::text[])',[ids]);
 const result={events:[],bookings,calendar:isPublic?{refund_policy:POLICY}:await settings(db),email_usage:{daily:0,monthly:0}};
 if(isPublic) {
   const counts=await db.q("SELECT event_id,count(*) AS n FROM bookings WHERE event_id=ANY(?::text[]) AND status IN ('pending','confirmed') GROUP BY event_id",[ids]);
   const reserved=new Map(counts.map(r=>[r.event_id,Number(r.n)]));
   for(const e of events) {
     e.reserved_count=reserved.get(e.id)||0;
     if(!bookings.some(b=>b.event_id===e.id&&b.status==='confirmed')) {
       if(e.location_type==='online')e.location='';
       e.confirmation_message='';
     }
   }
   result.guest_email=email;
 } else {
   result.host={email:a.email,admin:a.admin,practitioner_id:a.practitioner_id};
   if(a.admin) {
     result.host_accounts=await db.q('SELECT email,practitioner_id,admin,active FROM host_accounts ORDER BY email');
     result.email_usage=await usage(db);
   }
 }
 result.events=events.map(e=>({...e,has_started:instant(e.starts,e.zone)<=Date.now()}));
 for(const table of ['emails','contacts','campaigns','invitations','page_views','feedback','vouchers']) {
   result[table]=isPublic||!a.admin&&['emails','contacts','vouchers'].includes(table)?[]:
     await db.q('SELECT * FROM '+table+(a.admin?'':' WHERE event_id=ANY(?::text[])'),a.admin?[]:[ids]);
 }
 return result;
}

const addresses=value=>{const list=[...new Set(String(value||'').split(/[,;\s]+/).filter(Boolean).map(address))];check(list.length>0&&list.length<=200,'Enter up to 200 email addresses.');return list;};
async function queueCampaign(db,c){const people=c.event_id?(await db.q("SELECT DISTINCT email,status FROM bookings WHERE event_id=? AND status IN ('confirmed','approval','waitlist','pending')",[c.event_id])).filter(b=>c.audience==='all'||b.status===c.audience).map(b=>b.email):(await db.q('SELECT email FROM contacts WHERE subscribed=1')).map(b=>b.email);for(const email of new Set(people))await queueEmail(db,email,c.subject,c.body);await db.exec("UPDATE campaigns SET status='queued' WHERE id=?",[c.id]);return people.length;}
export async function schedules(db){for(const c of await db.q("SELECT * FROM campaigns WHERE status='scheduled'"))if(Date.parse(c.scheduled)<=Date.now())await queueCampaign(db,c);
 for(const e of await db.q('SELECT * FROM events WHERE cancelled=0 AND (reminders=1 OR feedback_enabled=1)')){const start=instant(e.starts,e.zone),end=e.ends?instant(e.ends,e.zone):start+3600000,tasks=[];if(e.reminders&&Date.now()<start)for(const hours of [24,1])if(Date.now()>=start-hours*3600000)tasks.push([String(hours),'Reminder: '+e.title,`${e.starts} (${e.zone})\n${e.location}`]);if(e.feedback_enabled&&Date.now()>=end)tasks.push(['feedback','How was '+e.title+'?','Share your feedback through your booking.']);for(const [kind,subject,body] of tasks)for(const b of await db.q("SELECT * FROM bookings WHERE event_id=? AND status='confirmed'",[e.id]))if((await db.exec('INSERT INTO scheduled_previews VALUES(?) ON CONFLICT DO NOTHING',[e.id+':'+kind+':'+b.id])).rowCount)await queueEmail(db,b.email,subject,body+'\n'+eventOrigin()+'/?booking='+b.id);}
}
export async function dashboardAction(db,path,p){
 if(path==='calendar-settings'){const value=await settings(db);for(const k of ['name','description','website','instagram','seller_name','seller_address','invoice_memo'])if(k in p)value[k]=text(p,k,2000,k==='name');if('tint'in p){check(/^#[0-9a-fA-F]{6}$/.test(p.tint),'Choose a valid colour.');value.tint=p.tint;}for(const [k,options] of [['default_visibility',['public','unlisted']],['status',['active','coming_soon','archived']]])if(k in p){check(options.includes(p[k]),'Invalid '+k);value[k]=p[k];}if('default_guest_list'in p)value.default_guest_list=!!p.default_guest_list;if('tags'in p){check(Array.isArray(p.tags)&&p.tags.length<=30,'Use up to 30 tags.');value.tags=[...new Set(p.tags.map(t=>String(t).trim().slice(0,60)).filter(Boolean))];}await db.exec('UPDATE calendar_settings SET value=? WHERE id=1',[JSON.stringify(value)]);return {ok:true};}
 if(path==='contact'){for(const email of addresses(p.emails))await db.exec('INSERT INTO contacts VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,subscribed=excluded.subscribed,tag=excluded.tag',[uuid(),text(p,'name',120)||email.split('@')[0],email,Number(!!p.subscribed),text(p,'tag',60),now()]);return {ok:true};}
 if(path==='voucher'){const code=text(p,'code',40,true).toUpperCase();check(/^[A-Z0-9_-]+$/.test(code),'Use a simple code.');await db.exec('INSERT INTO vouchers VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET percent=excluded.percent,active=excluded.active',[code,integer(p.percent,1,100),Number(p.active!==false)]);return {ok:true};}
 if(path==='campaign'){const id=p.id||uuid(),eid=p.event_id||'',audience=p.audience||'subscribers',old=await db.one('SELECT * FROM campaigns WHERE id=?',[id]);check(!old||old.status==='draft'&&old.event_id===eid,'Only drafts can be edited.');check((eid?['confirmed','approval','waitlist','all']:['subscribers']).includes(audience),'Invalid audience.');await db.exec('INSERT INTO campaigns VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET subject=excluded.subject,body=excluded.body,audience=excluded.audience',[id,eid,text(p,'subject',150,true),text(p,'body',10000,true),audience,'draft',now(),'']);return {id};}
 if(path==='campaign-queue'){const c=await db.one('SELECT * FROM campaigns WHERE id=?',[p.id]);check(c,'Draft not found.');if(c.status==='queued')return {count:0};if(p.scheduled){check(/(Z|[+-]\d\d:\d\d)$/.test(p.scheduled)&&Date.parse(p.scheduled)>Date.now(),'Choose a future date with timezone.');await db.exec("UPDATE campaigns SET status='scheduled',scheduled=? WHERE id=?",[new Date(p.scheduled).toISOString(),c.id]);return {count:0};}return {count:await queueCampaign(db,c)};}
 if(path==='view'){await db.exec('INSERT INTO page_views VALUES(?,?,?)',[uuid(),p.event_id,now()]);return {ok:true};}
 if(path==='feedback'){const b=await db.one("SELECT * FROM bookings WHERE id=? AND status='confirmed'",[p.booking_id]);check(b,'A confirmed booking is required.');const e=await db.one('SELECT * FROM events WHERE id=?',[b.event_id]);check(instant(e.ends||e.starts,e.zone)<=Date.now(),'Feedback opens after the event.');await db.exec('INSERT INTO feedback VALUES(?,?,?,?,?,?) ON CONFLICT(booking_id) DO UPDATE SET rating=excluded.rating,comment=excluded.comment',[uuid(),b.id,b.event_id,integer(p.rating,1,5),text(p,'comment',2000),now()]);return {ok:true};}
 const e=await db.one('SELECT * FROM events WHERE id=?',[p.event_id]);check(e,'Event not found.');
 if(path==='event-options'){for(const k of ['registration_open','guest_list_visible','reminders','feedback_enabled'])if(k in p)await db.exec('UPDATE events SET '+k+'=? WHERE id=?',[Number(!!p[k]),e.id]);if('confirmation_message'in p)await db.exec('UPDATE events SET confirmation_message=? WHERE id=?',[text(p,'confirmation_message',2000),e.id]);if('tags'in p){const s=await settings(db);check(Array.isArray(p.tags)&&p.tags.every(t=>s.tags.includes(t)),'Choose a calendar tag.');await db.exec('UPDATE events SET tags=? WHERE id=?',[JSON.stringify(p.tags),e.id]);}return {ok:true};}
 if(path==='invite'){let count=0;for(const email of addresses(p.emails))if((await db.exec('INSERT INTO invitations VALUES(?,?,?,?) ON CONFLICT DO NOTHING',[uuid(),e.id,email,now()])).rowCount){await queueEmail(db,email,'Invitation: '+e.title,text(p,'message',3000)+'\n'+e.starts+'\n'+eventOrigin()+'/?event='+e.id);count++;}return {count};}
 if(['blast','remind'].includes(path)){const subject=path==='remind'?'Reminder: '+e.title:text(p,'subject',150,true),body=path==='remind'?`${e.starts} (${e.zone})\n${e.location}`:text(p,'body',10000,true);let count=0;const audience=path==='remind'?'confirmed':(p.status||'confirmed');check(['confirmed','approval','waitlist','all'].includes(audience),'Choose an audience.');for(const b of await db.q("SELECT * FROM bookings WHERE event_id=? AND status IN ('confirmed','approval','waitlist','pending')",[e.id]))if(audience==='all'||b.status===audience){await queueEmail(db,b.email,subject,body);count++;}return {ok:true,count};}
 check(false,'Unknown action.',404);
}
