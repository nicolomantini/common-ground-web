/* Native test events, rendered using the main website's event-card styles. */
(async()=>{
 const list=document.getElementById('home-events'),message=document.getElementById('home-events-message');if(!list||!message)return;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 try{
  const response=await fetch('/api/public-state');if(!response.ok)throw Error();const state=await response.json();
  const events=state.events.filter(e=>e.published&&!e.cancelled&&!e.has_started&&e.visibility==='public').sort((a,b)=>a.starts.localeCompare(b.starts)).slice(0,3);
  list.replaceChildren();
  for(const e of events){const card=node('article',undefined,'luma-event-card'),cover=node('div',undefined,'luma-event-cover'),body=node('div',undefined,'luma-event-body'),content=node('div',undefined,'luma-event-content'),footer=node('div',undefined,'luma-event-footer');
   if(e.cover){const img=node('img');img.src=e.cover;img.alt='';img.loading='lazy';cover.append(img);}
   const date=node('time',new Date(e.starts.slice(0,10)+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})+' · '+e.starts.slice(11,16)+' · '+e.zone,'luma-event-time');date.dateTime=e.starts;content.append(date,node('h3',e.title));if(e.description)content.append(node('p',e.description,'luma-event-description'));
   if(e.hosts){const group=node('div',undefined,'luma-event-host-group');group.append(node('p','Hosted by','event-host-label'),node('span',e.hosts,'event-host'));footer.append(group);}
   const register=node('a','Register','btn-primary luma-event-register');register.href='/event-tool/?event='+encodeURIComponent(e.id);footer.append(register);body.append(content,footer);card.append(cover,body);list.append(card);
  }
  message.hidden=events.length>0;message.textContent=events.length?'':'No upcoming test events yet. Create one in the event dashboard.';
 }catch{message.hidden=false;message.textContent='Test events could not load. Please try again shortly.';}
})();
