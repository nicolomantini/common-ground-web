/* Full visitor page using the same tested registration and booking workflows. */
const visitorParams=new URLSearchParams(location.search);
if(visitorParams.has('discover'))document.querySelector('header nav').hidden=true;
const visitorMode=visitorParams.has('event')||visitorParams.has('booking');
const previousOpenEvent=openEvent;
let visitorPage=null;
function visitorHosts(e){
 const target=$('visitor-hosts');if(!target)return;target.replaceChildren();
 const ids=JSON.parse(e.host_ids||'[]');const people=hostDirectory.filter(p=>ids.includes(p.id));
 const hosts=people.length?people:e.hosts.split(',').filter(Boolean).map(name=>({name:name.trim()}));
 for(const host of hosts){const row=el('div',undefined,'visitor-host'),portrait=el('span',host.name.split(/\s+/).map(n=>n[0]).slice(0,2).join(''),'visitor-avatar');const photo=Journal.httpsURL(host.photo);if(photo){const img=el('img');img.src=photo;img.alt='';img.onerror=()=>img.remove();portrait.append(img);}row.append(portrait,el('span',host.name));target.append(row);}
}
function showVisitorPage(e){
 previousOpenEvent(e);$('detail').close();
 document.body.classList.add('visitor-mode');document.title=e.title+' · Common Ground';
 document.querySelector('header nav').hidden=true;
 document.querySelector('.brand').href='/?discover=1';
 for(const id of ['discover','studio','mail','workspace'])$(id).hidden=true;
 $('notice').hidden=true;
 visitorPage=el('section',undefined,'visitor-page');visitorPage.dataset.theme=e.theme||'peach';
 const back=el('a','← All gatherings','visitor-back');back.href='/?discover=1';visitorPage.append(back);
 const layout=el('div',undefined,'visitor-layout'),aside=el('aside',undefined,'visitor-aside'),content=el('div',undefined,'visitor-content');layout.append(aside,content);visitorPage.append(layout);document.querySelector('main').append(visitorPage);
 if(e.cover){const cover=el('img',undefined,'visitor-cover');cover.src=e.cover;cover.alt='Cover for '+e.title;aside.append(cover);}else{const art=el('div',undefined,'visitor-cover-placeholder');art.append(el('span','Common Ground'),el('small','Gather. Explore. Connect.'));aside.append(art);}
 const hosts=el('section',undefined,'visitor-host-section');hosts.append(el('h2','Hosted by'));const hostList=el('div');hostList.id='visitor-hosts';hosts.append(hostList);aside.append(hosts);
 aside.append(el('p','A Common Ground gathering','eyebrow'),el('p','Meditation, inquiry, and meaningful conversations.','muted'));
 const details=$('event-detail');details.replaceChildren(el('p','COME TOGETHER','eyebrow'),el('h1',e.title));
 const facts=el('div',undefined,'visitor-facts');const date=el('div');date.append(el('strong',new Date(e.starts).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})),el('span',e.starts.slice(11,16)+(e.ends?' – '+e.ends.slice(11,16):'')+' · '+e.zone));const place=el('div');place.append(el('strong',e.location_type==='online'?'Online gathering':e.location),el('span',e.location_type==='online'?'The meeting link is shared after confirmation.':'In-person gathering'));facts.append(date,place);details.append(facts);content.append(details);
 const register=el('section',undefined,'visitor-registration');content.append(register);register.setAttribute('aria-label','Registration');register.append(el('p','YOUR PLACE IN THE CIRCLE','eyebrow'));
 const price=el('p',eventPrice(e),'visitor-price');price.id='visitor-price';register.append(price);if(e.approval)register.append(el('p','Your host will review your request before confirming your place.','muted'));
 const room=Math.max(0,e.capacity-active(e));if(!e.cancelled&&!e.has_started&&e.published&&e.registration_open)register.append(el('p',room?`${room} ${room===1?'place':'places'} remaining`:e.waitlist?'This gathering is full. You can join the waiting list.':'This gathering is full.','muted visitor-places'));
 const fields=el('details',undefined,'visitor-registration-fields');fields.id='visitor-registration-fields';const summary=el('summary',e.approval?'Request a place':room?'Register for this gathering':'Join the waiting list');fields.append(summary,$('register-form'));register.append(fields,$('checkout'),$('booking-result'),$('booking-actions'));
 if(!e.published){$('register-form').hidden=true;$('booking-result').textContent='This gathering has not opened for registration yet.';}
 if(!room&&!e.waitlist){$('register-form').hidden=true;$('booking-result').textContent='This gathering is fully booked.';}
 if(e.cancelled){$('register-form').hidden=true;$('booking-result').textContent='This gathering has been cancelled.';}
 else if(e.has_started){$('register-form').hidden=true;$('booking-result').textContent='Registration has closed for this gathering.';}
 else if(!e.registration_open){$('register-form').hidden=true;$('booking-result').textContent='Registration is currently closed.';}
 if(!state.guest_email){$('register-form').hidden=true;const signIn=el('a','Sign in to register','link-button');signIn.href='/guest.html?return='+encodeURIComponent('/?event='+e.id);register.append(signIn);}else{$('register-form').elements.email.value=state.guest_email;$('register-form').elements.email.readOnly=true;}
 fields.hidden=$('register-form').hidden;
 register.append(el('p','Local test: no real payment is taken. Confirmation emails go to approved test addresses.','visitor-test-note'));content.append(register);
 const about=el('section',undefined,'visitor-about');about.append(el('h2','About the gathering'));const description=el('div',undefined,'formatted-description');if(e.description_html)description.innerHTML=Journal.cleanHTML(e.description_html);else{description.textContent=e.description;description.classList.add('description');}about.append(description);if(e.description||e.description_html)content.append(about);
 if(state.calendar.refund_policy){const policy=el('details',undefined,'visitor-policy');policy.append(el('summary','Cancellation policy'),el('p',state.calendar.refund_policy));content.append(policy);}
 if(e.guest_list_visible){const names=eventBookings(e).filter(b=>b.status==='confirmed').map(b=>b.name);if(names.length)content.append(el('p','Joining the gathering: '+names.join(', '),'muted'));}
 // Calendar download is shown only after confirmation: it can contain the private meeting link.
 $('event-share').replaceChildren(button('Copy invitation link',async()=>{try{await navigator.clipboard.writeText(location.origin+'/?event='+encodeURIComponent(e.id));$('visitor-share-status').textContent='Invitation link copied.';}catch{$('visitor-share-status').textContent=location.origin+'/?event='+encodeURIComponent(e.id);}}));const shareStatus=el('p',undefined,'muted');shareStatus.id='visitor-share-status';shareStatus.setAttribute('role','status');aside.append($('event-share'),shareStatus);
 layout.append(aside,content);visitorPage.append(layout);document.querySelector('main').append(visitorPage);visitorHosts(e);if(hostRequest)hostRequest.then(()=>visitorHosts(e));
}
openEvent=function(e){if(visitorMode){showVisitorPage(e);}else location.assign('/?event='+encodeURIComponent(e.id));};
const visitorOriginalResult=registrationResult;
registrationResult=function(b){visitorOriginalResult(b);if(!visitorMode)return;
 $('visitor-registration-fields').hidden=true;
 document.querySelector('.visitor-places')?.remove();
 $('visitor-price').textContent='Chosen contribution · '+money(b.amount||0);
 if(b.status==='confirmed'){const calendar=el('a','Add to calendar','link-button');calendar.href='/api/calendar?id='+encodeURIComponent(selected.id);calendar.download='event.ics';$('booking-actions').append(calendar);$('booking-result').textContent='Your place is confirmed. We look forward to seeing you. This is a local test booking.';}
 if(b.status==='pending')$('booking-result').textContent='Continue to Stripe test checkout to confirm your place.';
 history.replaceState(null,'','/?booking='+encodeURIComponent(b.id));
 $('booking-result').scrollIntoView({behavior:'auto',block:'nearest'});
};
const originalOpenRoute=openRoute;
openRoute=function(){if(!visitorMode){originalOpenRoute();return;}const b=state.bookings.find(x=>x.id===visitorParams.get('booking'));const e=state.events.find(x=>x.id===(b?.event_id||visitorParams.get('event')));if(!e||(visitorParams.has('booking')&&!b)){document.body.classList.add('visitor-mode');document.querySelector('header nav').hidden=true;for(const id of ['discover','studio','mail','workspace'])$(id).hidden=true;const missing=el('section',undefined,'visitor-missing');missing.append(el('h1','We couldn’t find this invitation'),el('p','Check the link or return to the gatherings list.'));const link=el('a','See gatherings','link-button');link.href='/?discover=1';missing.append(link);document.querySelector('main').append(missing);return;}openEvent(e);if(b)registrationResult(b);};
const myBookingsLink=el('a','My bookings','link-button');myBookingsLink.href='/guest.html';document.querySelector('header').append(myBookingsLink);

// Reconciliation runs on the server even when the guest closes Checkout.
setInterval(async()=>{if(!visitorMode||!booking||booking.status!=='pending')return;try{await refresh();const current=state.bookings.find(b=>b.id===booking.id);if(current&&current.status!==booking.status){selected=state.events.find(e=>e.id===current.event_id);registrationResult(current);}}catch{}},10000);
