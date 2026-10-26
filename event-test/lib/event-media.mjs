import {createHash} from 'node:crypto';
import {check} from './core.mjs';
import {host,guest,manages} from './auth.mjs';

// Keep existing covers intact while removing base64 data from JSON responses.
// Storage migration can happen later without changing the browser contract.
export function coverURL(id,cover) {
  return cover ? '/api/event-cover?id='+encodeURIComponent(id)+'&v='+createHash('md5').update(cover).digest('hex') : '';
}
export const eventJSON = `((to_jsonb(e) - 'cover') || jsonb_build_object('cover',
  CASE WHEN e.cover = '' THEN '' ELSE '/api/event-cover' || chr(63) || 'id=' || e.id || '&v=' || md5(e.cover) END)) AS event`;

export async function eventCover(db,req,url) {
  const e=await db.one('SELECT id,cover,published,cancelled,visibility,host_ids FROM events WHERE id=?',[url.searchParams.get('id')]);
  check(e?.cover,'Image not found.',404);
  const visible=Boolean(e.published&&!e.cancelled&&e.visibility==='public');
  if(!visible && !(e.published&&!e.cancelled&&e.visibility==='unlisted')) {
    const a=await host(db,req);
    if(!manages(a,e)) {
      const email=await guest(db,req,false);
      check(email&&await db.one('SELECT 1 FROM bookings WHERE event_id=? AND lower(email)=?',[e.id,email]),'Image not found.',404);
    }
  }
  check(url.searchParams.get('v')===createHash('md5').update(e.cover).digest('hex'),'Image not found.',404);
  const match=/^data:image\/(jpeg|png|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(e.cover);
  check(match,'Image not found.',404);
  return new Response(Buffer.from(match[2],'base64'),{headers:{
    'Content-Type':'image/'+match[1],
    'Cache-Control':visible?'private, max-age=300':'no-store',
    'X-Content-Type-Options':'nosniff'
  }});
}
