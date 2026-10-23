import {address,allowed,check,fail,pw,verify,hash,token,now,cookie,sessionCookie,queueEmail,origin,eventOrigin,eligible,refundMessage} from './core.mjs';
export const manages=(a,e)=>Boolean(a&&e&&(a.admin||JSON.parse(e.host_ids||'[]').includes(a.practitioner_id)));
export async function host(db,req){return db.one('SELECT a.* FROM host_accounts a JOIN host_sessions s ON a.email=s.email WHERE s.token_hash=? AND s.expires>? AND a.active=1',[hash(cookie(req,'cg_host')),now()]);}
export async function guest(db,req,required=true){const r=await db.one('SELECT email FROM guest_sessions WHERE token_hash=? AND expires>?',[hash(cookie(req,'cg_guest')),now()]);if(required)check(r,'Sign in to see your bookings.',401);return r?.email;}
export async function owns(db,req,id){const b=await db.one('SELECT * FROM bookings WHERE id=?',[id]);check(b,'Booking not available.',403);const e=await db.one('SELECT * FROM events WHERE id=?',[b.event_id]);if(!manages(await host(db,req),e))check(b.email.toLowerCase()===await guest(db,req),'This booking belongs to another guest.',403);return b;}
export async function authorize(db,req,path,p){
 if(['host-login','host-logout','guest-request','guest-consume','guest-logout','guest-cancel'].includes(path))return;
 if(['pay','cancel','feedback'].includes(path)){await owns(db,req,path==='feedback'?p.booking_id:p.id);return;}
 if(path==='register'){check(address(p.email)===await guest(db,req),'Use the email you signed in with.',403);return;}
 if(path==='view'){const e=await db.one('SELECT * FROM events WHERE id=?',[p.event_id]);check(e?.published&&!e.cancelled,'Event unavailable.',403);return;}
 const a=await host(db,req);check(a,'Sign in as a host.',401);
 if(['host-account','calendar-settings','contact','voucher','send-preview'].includes(path)){check(a.admin,'Administrator access required.',403);return;}
 if(path==='event'){if(p.id)check(manages(a,await db.one('SELECT * FROM events WHERE id=?',[p.id])),'You are not a host of this event.',403);check(a.admin||p.host_ids?.includes(a.practitioner_id),'Keep yourself assigned as a host.',403);return;}
 let eid=p.event_id;
 if(['campaign','campaign-queue'].includes(path)){const c=p.id?await db.one('SELECT * FROM campaigns WHERE id=?',[p.id]):null;if(c){if(path==='campaign')check(c.event_id===(p.event_id||''),'Campaign event cannot change.',403);eid=c.event_id;}if(!eid){check(a.admin,'Administrator access required.',403);return;}}
 check(manages(a,await db.one('SELECT * FROM events WHERE id=?',[eid])),'You are not a host of this event.',403);
}
export async function authAction(db,req,path,p){
 if(path==='host-login'){
  const email=address(p.email),a=await db.one('SELECT * FROM host_accounts WHERE email=? AND active=1',[email]),attempt=await db.one('SELECT * FROM host_attempts WHERE email=?',[email]);
  if(attempt&&Date.parse(attempt.reset_at)>Date.now()&&attempt.failures>=5)return {error:'Too many attempts. Try again in 15 minutes.'};
  if(!a||!verify(p.password,a.password_hash)){const active=attempt&&Date.parse(attempt.reset_at)>Date.now();await db.exec('INSERT INTO host_attempts VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET failures=excluded.failures,reset_at=excluded.reset_at',[email,active?attempt.failures+1:1,active?attempt.reset_at:new Date(Date.now()+900000).toISOString()]);return {error:'Email or password is incorrect.'};}
  const value=token();await db.exec('DELETE FROM host_attempts WHERE email=?',[email]);await db.exec('INSERT INTO host_sessions VALUES(?,?,?)',[hash(value),email,new Date(Date.now()+28800000).toISOString()]);return {ok:true,_cookie:sessionCookie('cg_host',value,1/3)};
 }
 if(path==='host-logout'||path==='guest-logout'){const name=path.startsWith('host')?'cg_host':'cg_guest',table=name==='cg_host'?'host_sessions':'guest_sessions';await db.exec(`DELETE FROM ${table} WHERE token_hash=?`,[hash(cookie(req,name))]);return {ok:true,_cookie:sessionCookie(name,'',0)};}
 if(path==='host-account'){
  const email=address(p.email),pid=String(p.practitioner_id||''),old=await db.one('SELECT * FROM host_accounts WHERE email=?',[email]);check(!old?.admin,'Administrator access cannot be changed here.');check(await db.one('SELECT 1 FROM public.counselors WHERE id::text=? AND approved=true',[pid]),'Choose a practitioner.');const password=p.password?pw(p.password):old?.password_hash;check(password,'Set an initial password.');await db.exec('INSERT INTO host_accounts VALUES(?,?,0,?,?) ON CONFLICT(email) DO UPDATE SET practitioner_id=excluded.practitioner_id,password_hash=excluded.password_hash,active=excluded.active',[email,pid,password,Number(!!p.active)]);await db.exec('DELETE FROM host_sessions WHERE email=?',[email]);return {ok:true};
 }
 if(path==='guest-request'){
  const email=address(p.email);check(allowed(email),'This test is limited to approved email addresses.');const recent=await db.one('SELECT 1 FROM guest_links WHERE email=? AND created>?',[email,new Date(Date.now()-60000).toISOString()]);
  if(!recent){const value=token();await db.exec('UPDATE guest_links SET used=1 WHERE email=?',[email]);await db.exec('INSERT INTO guest_links VALUES(?,?,?,?,0)',[hash(value),email,new Date(Date.now()+900000).toISOString(),now()]);await queueEmail(db,email,'Your Common Ground sign-in link',`Sign in to manage your bookings.\n\n${eventOrigin()}/guest.html#token=${value}\n\nThis link expires in 15 minutes and works once. If you did not request it, ignore this message.`,true);}
  return {ok:true,retry_after:recent?60:0,delivery:'queued'};
 }
 if(path==='guest-consume'){
  const row=await db.one('SELECT * FROM guest_links WHERE token_hash=?',[hash(p.token||'')]);check(row&&!row.used&&Date.parse(row.expires)>Date.now(),'This sign-in link has expired or was already used.');await db.exec('UPDATE guest_links SET used=1 WHERE token_hash=?',[row.token_hash]);const value=token();await db.exec('INSERT INTO guest_sessions VALUES(?,?,?)',[hash(value),row.email,new Date(Date.now()+604800000).toISOString()]);return {ok:true,_cookie:sessionCookie('cg_guest',value,7)};
 }
 return null;
}
export async function guestBookings(db,req){const email=await guest(db,req),result=[];for(const b of await db.q('SELECT * FROM bookings WHERE lower(email)=? ORDER BY created DESC',[email])){const e=await db.one('SELECT * FROM events WHERE id=?',[b.event_id]);if(!e)continue;result.push({id:b.id,status:b.status,amount:b.amount,name:b.name,ticket_name:b.ticket_name,refund_status:b.refund_status,refund_amount:b.refund_amount,refund_message:refundMessage(b.refund_status),refund_eligible:eligible(e),event:Object.fromEntries(['id','title','starts','ends','zone','cover','location_type','cancelled'].map(k=>[k,e[k]])),location:b.status==='confirmed'?e.location:'',can_cancel:['confirmed','pending','approval','waitlist'].includes(b.status)});}return {email,bookings:result};}
