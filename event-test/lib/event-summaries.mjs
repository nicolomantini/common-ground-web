import {check,integer} from './core.mjs';

// Date input is normally local to the event zone; also handle imported ISO offsets.
const startInstant="(CASE WHEN e.starts ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN e.starts::timestamptz ELSE e.starts::timestamp AT TIME ZONE e.zone END)";
const publicOnly="e.published=1 AND e.cancelled=0 AND e.visibility='public'";
export async function eventSummaries(db,url) {
  const period=url.searchParams.get('period')||'upcoming';
  check(['upcoming','past'].includes(period),'Invalid event period.');
  const limit=integer(url.searchParams.get('limit')||50,1,100);
  const offset=integer(url.searchParams.get('offset')||0,0,100000);
  const date=url.searchParams.get('date')||'';
  check(!date||/^\d{4}-\d{2}-\d{2}$/.test(date),'Invalid event date.');
  const scope=publicOnly+' AND '+startInstant+(period==='past'?' <= now()':' > now()');
  const rows=await db.q(`SELECT e.id,e.title,left(e.description,240) AS description,e.starts,e.ends,e.zone,e.hosts,e.host_ids,e.location_type,
    CASE WHEN e.location_type='online' THEN '' ELSE e.location END AS location,
    CASE WHEN e.cover='' THEN '' ELSE '/api/event-cover' || chr(63) || 'id=' || e.id || '&v=' || md5(e.cover) END AS cover,
    (${startInstant}<=now()) AS has_started
    FROM events e WHERE ${scope}${date?' AND left(e.starts,10)=?':''}
    ORDER BY ${startInstant} ${period==='past'?'DESC':'ASC'}, e.id LIMIT ? OFFSET ?`,[...(date?[date]:[]),limit+1,offset]);
  const dates=url.searchParams.get('dates')==='1'
    ? (await db.q(`SELECT DISTINCT left(e.starts,10) AS date FROM events e WHERE ${scope} ORDER BY date`)).map(r=>r.date)
    : [];
  return {events:rows.slice(0,limit),next_offset:rows.length>limit?offset+limit:null,dates};
}
