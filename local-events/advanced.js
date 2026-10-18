/* Additional local event workflows; all data stays in the demo server. */
let chosenGuests=new Set();
const richDescription=new Quill('#event-writing',{theme:'snow',placeholder:'Tell guests what to expect…',formats:['bold','italic','header','list','blockquote','align'],modules:{toolbar:[[{header:[2,3,false]}],['bold','italic','blockquote'],[{list:'ordered'},{list:'bullet'}],[{align:[]}],['clean']]}});
richDescription.root.setAttribute('role','textbox');richDescription.root.setAttribute('aria-label','Event description');richDescription.root.setAttribute('aria-multiline','true');
richDescription.on('text-change',()=>{$('event-form').elements.description.value=richDescription.getText().trim();});

function tiers(e){return JSON.parse(e.tickets||'[]').length?JSON.parse(e.tickets):[{id:'standard',name:'Standard',price:e.price,capacity:e.capacity}];}
function ticketRow(t={id:crypto.randomUUID(),name:'',price:0,capacity:12}){
 const row=el('div',undefined,'ticket-edit-row');row.dataset.id=t.id;
 for(const [key,label,type,value] of [['name','Ticket name','text',t.name],['capacity','Ticket quantity','number',t.capacity]]){const l=el('label',label),i=el('input');i.type=type;i.dataset.key=key;i.value=value;i.required=true;if(type==='number'){i.min=key==='price'?0:1;i.max=key==='price'?10000:10000;i.step=key==='price'?'.01':'1';}l.append(i);row.append(l);}
 row.append(button('Remove',()=>row.remove()));$('ticket-editor').append(row);
}
function questionRow(q={id:crypto.randomUUID(),label:'',required:false}){
 const row=el('div',undefined,'question-edit-row');row.dataset.id=q.id;const label=el('label','Question'),input=el('input');input.value=q.label;input.required=true;input.maxLength=200;input.dataset.key='label';label.append(input);
 const required=el('label','Required','check'),check=el('input');check.type='checkbox';check.checked=q.required;check.dataset.key='required';required.prepend(check);row.append(label,required,button('Remove',()=>row.remove()));$('question-editor').append(row);
}
$('add-ticket').onclick=()=>{const f=$('event-form');if(!$('ticket-editor').children.length&&f.elements.id.value)ticketRow({id:'standard',name:'Standard',price:Math.round(Number(f.elements.price.value)*100),capacity:Number(f.elements.capacity.value)});ticketRow();};$('add-question').onclick=()=>questionRow();
function editExtras(e){editHostLocationContribution(e);richDescription.setContents(e?.description_html?richDescription.clipboard.convert({html:Journal.cleanHTML(e.description_html)}):richDescription.clipboard.convert({text:e?.description||''}));richDescription.history.clear();const f=$('event-form');f.elements.visibility.value=e?.visibility||'public';f.elements.theme.value=e?.theme||'peach';f.elements.approval.checked=!!e?.approval;f.elements.waitlist.checked=e?!!e.waitlist:true;$('ticket-editor').replaceChildren();$('question-editor').replaceChildren();for(const t of JSON.parse(e?.tickets||'[]'))ticketRow(t);for(const q of JSON.parse(e?.questions||'[]'))questionRow(q);for(const d of document.querySelectorAll('.advanced-panel'))d.open=false;}
function saveExtras(p){saveHostLocationContribution(p);p.description=richDescription.getText().trim();p.description_html=Journal.cleanHTML(richDescription.getSemanticHTML());if(p.description.length>10000)throw Error('Please keep the description under 10,000 characters.');const f=$('event-form');p.approval=f.elements.approval.checked;p.waitlist=f.elements.waitlist.checked;p.tickets=[...$('ticket-editor').children].map(row=>({id:row.dataset.id,name:row.querySelector('[data-key=name]').value,price:Math.round(Number(f.elements.donation_suggested.value)*100),capacity:Number(row.querySelector('[data-key=capacity]').value)}));p.questions=[...$('question-editor').children].map(row=>({id:row.dataset.id,label:row.querySelector('[data-key=label]').value,required:row.querySelector('[data-key=required]').checked}));}
function eventExtras(e){showContribution(e);
 if(e.description_html){const text=$('event-detail').querySelector('.description');text.innerHTML=Journal.cleanHTML(e.description_html);text.classList.add('formatted-description');}
 $('detail').dataset.theme=e.theme||'peach';$('event-share').replaceChildren();$('booking-actions').replaceChildren();
 if(e.cover){const img=el('img',undefined,'detail-cover');img.src=e.cover;img.alt='';$('event-detail').prepend(img);}
 if(e.ends)$('event-detail').append(el('p','Ends '+e.ends.replace('T',' · ')+' · '+e.zone,'muted'));
 const link=el('a','Add to calendar','link-button');link.href='/api/calendar?id='+encodeURIComponent(e.id);link.download='event.ics';
 const permalink=location.origin+'/?event='+encodeURIComponent(e.id);
 $('event-share').append(link,button('Copy event link',async()=>{try{await navigator.clipboard.writeText(permalink);$('booking-result').textContent='Event link copied. This localhost link works only on this computer.';}catch{$('booking-result').textContent=permalink;}}));
 const choice=$('ticket-choice');choice.replaceChildren();for(const t of tiers(e)){const opt=el('option',t.name+(e.pricing_mode==='donation'?' · Sliding scale':' · '+money(t.price)));opt.value=t.id;choice.append(opt);}
 $('registration-questions').replaceChildren();for(const q of JSON.parse(e.questions||'[]')){const label=el('label',q.label+(q.required?' *':'')),input=el('textarea');input.rows=2;input.dataset.question=q.id;input.required=q.required;input.maxLength=2000;label.append(input);$('registration-questions').append(label);}
 if(e.location_type==='online')$('event-detail').append(el('p','Your meeting link will be included in your confirmation.','muted'));
 if(e.approval)$('event-detail').append(el('p','Registration requires host approval.','badge'));
 if(e.cancelled){$('register-form').hidden=true;$('booking-result').textContent='This event has been cancelled.';}
 else if(e.has_started){$('register-form').hidden=true;$('booking-result').textContent='This event has already started.';}
 else if(e.approval)$('register-submit').textContent='Request to join';
 else if(e.pricing_mode==='donation')$('register-submit').textContent='Continue with my contribution';
}
function registrationResult(b){
 booking=b;$('checkout').querySelector('h3').textContent='Test checkout · '+money(b.amount||0);$('register-form').hidden=true;$('checkout').hidden=b.status!=='pending';$('booking-actions').replaceChildren();
 if(b.status==='confirmed'&&selected.location_type==='online'){const url=Journal.httpsURL(selected.location);if(url){const join=el('a','Join online event','link-button');join.href=url;join.target='_blank';join.rel='noopener noreferrer';$('booking-actions').append(join);}}
 const messages={confirmed:'You’re going! Your confirmation is in Email previews.',approval:'Request received. Your place is not confirmed until a host approves it.',waitlist:'You’re on the waiting list. A host can offer you a place when one becomes available.',pending:'Your place is reserved for ten minutes. Complete the simulated checkout below.',cancelled:'This registration has been cancelled.',declined:'Your registration request was declined.',expired:'This payment reservation expired. You can register again if places remain.'};
 $('booking-result').textContent=messages[b.status]||b.status;
 $('booking-actions').append(button('Copy booking link',async()=>{const url=location.origin+'/?booking='+encodeURIComponent(b.id);try{await navigator.clipboard.writeText(url);$('booking-result').textContent='Private test booking link copied.';}catch{$('booking-result').textContent=url;}}));
 if(['confirmed','pending','approval','waitlist'].includes(b.status))$('booking-actions').append(button('Cancel my registration',async()=>{if(!confirm('Cancel this test registration?'))return;try{await api('cancel',{id:b.id});await refresh();registrationResult(state.bookings.find(x=>x.id===b.id));}catch(e){$('booking-result').textContent=e.message;}}));
}
function visibleGuests(){const search=$('guest-search').value.toLowerCase(),status=$('guest-status').value;return state.bookings.filter(b=>b.event_id===guestEvent.id&&(b.name+' '+b.email).toLowerCase().includes(search)&&(status==='all'||(status==='checked'?b.checked_in:b.status===status)));}
function drawAdvancedGuests(){
 const all=state.bookings.filter(b=>b.event_id===guestEvent.id);$('guest-summary').replaceChildren();for(const [label,count] of [['Going',all.filter(b=>b.status==='confirmed').length],['Requests',all.filter(b=>b.status==='approval').length],['Waitlist',all.filter(b=>b.status==='waitlist').length],['Checked in',all.filter(b=>b.checked_in).length]]){const block=el('div');block.append(el('strong',String(count)),el('span',label));$('guest-summary').append(block);}
 const list=$('guest-list');list.replaceChildren();for(const b of visibleGuests()){
  const row=el('article',undefined,'guest-row'),label=el('label',undefined,'check'),check=el('input');check.type='checkbox';check.checked=chosenGuests.has(b.id);check.setAttribute('aria-label','Select '+b.name);check.onchange=()=>check.checked?chosenGuests.add(b.id):chosenGuests.delete(b.id);label.append(check,el('strong',b.name));row.append(label,el('p',b.email,'muted'),el('span',b.status+(b.checked_in?' · Checked in':''),'badge'),el('p',b.ticket_name+' · '+money(b.amount),'muted'));
  const actions=el('div',undefined,'actions');for(const [title,action] of b.status==='approval'||b.status==='waitlist'?[['Approve','approve'],['Decline','decline']]:b.status==='confirmed'?[[b.checked_in?'Undo check-in':'Check in','checkin']]:[])actions.append(button(title,()=>guestAction(action,[b.id])));
  if(['confirmed','approval','waitlist','pending'].includes(b.status))actions.append(button('Cancel registration',()=>{if(confirm('Cancel this registration?'))guestAction('cancel',[b.id]);}));
  actions.append(button('View booking',()=>{$('attendees').close();openEvent(guestEvent);registrationResult(b);}));row.append(actions);
  const answers=JSON.parse(b.answers||'[]');if(answers.length){const details=el('details'),summary=el('summary','Registration answers');details.append(summary);for(const a of answers)details.append(el('strong',a.label),el('p',a.answer||'—'));row.append(details);}list.append(row);
 }if(!list.children.length)list.append(el('p','No guests match this view.'));
}
async function guestAction(action,ids){try{await api('guest-action',{event_id:guestEvent.id,action,ids});chosenGuests.clear();$('guest-message').textContent='Guest list updated.';await refresh();drawAdvancedGuests();}catch(e){$('guest-message').textContent=e.message;}}
$('guest-search').oninput=drawAdvancedGuests;$('guest-status').onchange=()=>{chosenGuests.clear();drawAdvancedGuests();};$('select-guests').onclick=()=>{for(const b of visibleGuests())chosenGuests.add(b.id);drawAdvancedGuests();};for(const b of document.querySelectorAll('[data-bulk]'))b.onclick=()=>guestAction(b.dataset.bulk,[...chosenGuests]);
$('blast-form').onsubmit=async ev=>{ev.preventDefault();const f=ev.target,b=f.querySelector('button');b.disabled=true;try{const result=await api('blast',{event_id:guestEvent.id,...Object.fromEntries(new FormData(f))});await refresh();$('guest-message').textContent=`Created ${result.count} email previews. Nothing has been sent.`;f.reset();}catch(e){$('guest-message').textContent=e.message;}finally{b.disabled=false;}};
$('event-search').oninput=render;$('event-period').onchange=render;
async function duplicateEvent(e){try{const result=await api('duplicate',{event_id:e.id});await refresh();edit(state.events.find(x=>x.id===result.id));}catch(err){$('notice').textContent=err.message;}}
async function cancelEvent(e){if(!confirm('Cancel this test event and all active registrations? This cannot be undone.'))return;try{await api('cancel-event',{event_id:e.id});await refresh();}catch(err){$('notice').textContent=err.message;}}
function openRoute(){const p=new URLSearchParams(location.search);const b=state.bookings.find(x=>x.id===p.get('booking'));const e=state.events.find(x=>x.id===(b?.event_id||p.get('event')));if(e){openEvent(e);if(b)registrationResult(b);}}
