const $=id=>document.getElementById(id),make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const now=new Date();let month=new Date(now.getFullYear(),now.getMonth(),1),period='upcoming',selected='',events=[],people=[],eventDates=[],nextOffset=null,requestNumber=0;
const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dayDate=s=>new Date(s+'T12:00:00');
const matching=()=>events.filter(e=>period==='past'?e.has_started:!e.has_started);
function renderCalendar(){
 $('month-label').textContent=month.toLocaleDateString('en-GB',{month:'long',year:'numeric'});$('calendar-days').replaceChildren();
 const dates=new Set(eventDates),start=new Date(month);start.setDate(1-(month.getDay()+6)%7);
 for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const date=key(d),b=make('button',d.getDate());b.className=[d.getMonth()!==month.getMonth()?'outside':'',date===key(now)?'today':'',date===selected?'selected':'',dates.has(date)?'has-event':''].join(' ');b.setAttribute('aria-label',d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})+(dates.has(date)?', has events':''));b.setAttribute('aria-pressed',String(selected===date));b.onclick=()=>{selected=selected===date?'':date;loadEvents();};$('calendar-days').append(b);}
}
function render(){
 renderCalendar();$('upcoming').setAttribute('aria-pressed',String(period==='upcoming'));$('past').setAttribute('aria-pressed',String(period==='past'));$('clear-date').hidden=!selected;$('list-title').textContent=(period==='past'?'Past':'Upcoming')+' events'+(selected?' · '+dayDate(selected).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'');
 const rows=matching().filter(e=>!selected||e.starts.slice(0,10)===selected);$('event-list').replaceChildren();$('event-status').textContent=rows.length?'':selected?'No '+period+' events on this date. Choose another day or show all dates.':'No '+period+' events yet.';
 let last='',group;
 for(const e of rows){const date=e.starts.slice(0,10);if(date!==last){group=make('section',undefined,'event-day');const h=make('h3',dayDate(date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}));h.append(make('span',dayDate(date).toLocaleDateString('en-GB',{weekday:'long'})));group.append(h);$('event-list').append(group);last=date;}
 const card=make('article',undefined,'event-invitation'),copy=make('div',undefined,'event-copy'),url='/event-tool/?event='+encodeURIComponent(e.id),time=make('time',e.starts.slice(11,16)+' · '+e.zone,'event-time');time.dateTime=e.starts;copy.append(time);const title=make('h4'),link=make('a',e.title);link.href=url;title.append(link);copy.append(title);
 const hosts=make('div',undefined,'event-hosts'),portraits=make('span',undefined,'host-portraits');let ids=[];try{ids=JSON.parse(e.host_ids||'[]');}catch{}for(const p of people.filter(p=>ids.includes(p.id))){if(p.photo){const img=make('img');img.src=p.photo;img.alt='';img.loading='lazy';portraits.append(img);}}hosts.append(portraits,make('span',e.hosts?'By '+e.hosts:'Common Ground'));copy.append(hosts,make('div',e.location_type==='online'?'Online event':e.location||'In person','event-location'));
 const cta=make('a',period==='past'?'View event →':'Register →','event-cta');cta.href=url;copy.append(cta);card.append(copy);if(e.cover){const img=make('img',undefined,'event-photo');img.src=e.cover;img.alt='';img.loading='lazy';img.onerror=()=>img.remove();card.append(img);}group.append(card);
 }
}
const more=make('button','Show more events','event-cta');
more.type='button';more.hidden=true;$('event-list').after(more);
more.onclick=()=>loadEvents(true);
async function loadEvents(append=false) {
 const request=++requestNumber;
 more.disabled=true;
 if(!append){events=[];render();$('event-status').textContent='Loading events…';more.hidden=true;}
 const params=new URLSearchParams({period,limit:'50',offset:String(append?nextOffset||0:0),dates:'1'});
 if(selected)params.set('date',selected);
 try {
  const response=await fetch('/api/event-summaries?'+params);
  if(!response.ok)throw Error();
  const result=await response.json();
  if(request!==requestNumber)return;
  events=append?[...events,...result.events]:result.events;
  eventDates=result.dates;nextOffset=result.next_offset;
  render();more.hidden=nextOffset===null;
 } catch {
  if(request===requestNumber){$('event-status').textContent='Events could not load. Please refresh to try again.';more.hidden=!append;}
 } finally {if(request===requestNumber)more.disabled=false;}
}
for(const p of ['upcoming','past'])$(p).onclick=()=>{period=p;selected='';loadEvents();};
$('clear-date').onclick=()=>{selected='';loadEvents();};
$('previous-month').onclick=()=>{month.setMonth(month.getMonth()-1);renderCalendar();};
$('next-month').onclick=()=>{month.setMonth(month.getMonth()+1);renderCalendar();};
$('today').onclick=()=>{month=new Date(now.getFullYear(),now.getMonth(),1);selected='';loadEvents();};
renderCalendar();
loadEvents();
fetch('/api/practitioners').then(async response=>{if(response.ok){people=(await response.json()).practitioners;if(events.length)render();}}).catch(()=>{});
