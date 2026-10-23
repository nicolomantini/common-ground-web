const $=id=>document.getElementById(id),make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const now=new Date();let month=new Date(now.getFullYear(),now.getMonth(),1),period='upcoming',selected='',events=[],people=[];
const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dayDate=s=>new Date(s+'T12:00:00');
const matching=()=>events.filter(e=>period==='past'?e.has_started:!e.has_started);
function renderCalendar(){
 $('month-label').textContent=month.toLocaleDateString('en-GB',{month:'long',year:'numeric'});$('calendar-days').replaceChildren();
 const dates=new Set(matching().map(e=>e.starts.slice(0,10))),start=new Date(month);start.setDate(1-(month.getDay()+6)%7);
 for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const date=key(d),b=make('button',d.getDate());b.className=[d.getMonth()!==month.getMonth()?'outside':'',date===key(now)?'today':'',date===selected?'selected':'',dates.has(date)?'has-event':''].join(' ');b.setAttribute('aria-label',d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})+(dates.has(date)?', has events':''));b.setAttribute('aria-pressed',String(selected===date));b.onclick=()=>{selected=selected===date?'':date;render();};$('calendar-days').append(b);}
}
function render(){
 renderCalendar();$('upcoming').setAttribute('aria-pressed',String(period==='upcoming'));$('past').setAttribute('aria-pressed',String(period==='past'));$('clear-date').hidden=!selected;$('list-title').textContent=(period==='past'?'Past':'Upcoming')+' events'+(selected?' · '+dayDate(selected).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'');
 const rows=matching().filter(e=>!selected||e.starts.slice(0,10)===selected).sort((a,b)=>(period==='past'?-1:1)*a.starts.localeCompare(b.starts));$('event-list').replaceChildren();$('event-status').textContent=rows.length?'':selected?'No '+period+' events on this date. Choose another day or show all dates.':'No '+period+' events yet.';
 let last='',group;
 for(const e of rows){const date=e.starts.slice(0,10);if(date!==last){group=make('section',undefined,'event-day');const h=make('h3',dayDate(date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}));h.append(make('span',dayDate(date).toLocaleDateString('en-GB',{weekday:'long'})));group.append(h);$('event-list').append(group);last=date;}
 const card=make('article',undefined,'event-invitation'),copy=make('div',undefined,'event-copy'),url='/event-tool/?event='+encodeURIComponent(e.id),time=make('time',e.starts.slice(11,16)+' · '+e.zone,'event-time');time.dateTime=e.starts;copy.append(time);const title=make('h4'),link=make('a',e.title);link.href=url;title.append(link);copy.append(title);
 const hosts=make('div',undefined,'event-hosts'),portraits=make('span',undefined,'host-portraits');let ids=[];try{ids=JSON.parse(e.host_ids||'[]');}catch{}for(const p of people.filter(p=>ids.includes(p.id))){if(p.photo){const img=make('img');img.src=p.photo;img.alt='';img.loading='lazy';portraits.append(img);}}hosts.append(portraits,make('span',e.hosts?'By '+e.hosts:'Common Ground'));copy.append(hosts,make('div',e.location_type==='online'?'Online event':e.location||'In person','event-location'));
 const cta=make('a',period==='past'?'View event →':'Register →','event-cta');cta.href=url;copy.append(cta);card.append(copy);if(e.cover){const img=make('img',undefined,'event-photo');img.src=e.cover;img.alt='';img.loading='lazy';img.onerror=()=>img.remove();card.append(img);}group.append(card);
 }
}
for(const p of ['upcoming','past'])$(p).onclick=()=>{period=p;selected='';render();};$('clear-date').onclick=()=>{selected='';render();};$('previous-month').onclick=()=>{month.setMonth(month.getMonth()-1);renderCalendar();};$('next-month').onclick=()=>{month.setMonth(month.getMonth()+1);renderCalendar();};$('today').onclick=()=>{month=new Date(now.getFullYear(),now.getMonth(),1);selected='';render();};
renderCalendar();
try{const [response,practitioners]=await Promise.all([fetch('/api/public-state'),fetch('/api/practitioners')]);if(!response.ok)throw Error();const state=await response.json();events=state.events.filter(e=>e.published&&!e.cancelled&&e.visibility==='public');if(practitioners.ok)people=(await practitioners.json()).practitioners;render();}catch{$('event-status').textContent='Events could not load. Please refresh to try again.';}
