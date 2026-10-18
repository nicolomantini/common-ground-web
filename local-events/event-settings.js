let hostDirectory=[],pickedHosts=[],hostRequest=null;
function renderHostPicker(){
 const box=$('host-picker');box.replaceChildren();
 for(const p of hostDirectory){const label=el('label',undefined,'host-option'),input=el('input');input.type='checkbox';input.value=p.id;input.checked=pickedHosts.includes(p.id);input.onchange=()=>{pickedHosts=[...box.querySelectorAll('input:checked')].map(i=>i.value);};const photo=el('span',p.name.split(/\s+/).map(w=>w[0]).slice(0,2).join(''),'host-photo');photo.setAttribute('aria-hidden','true');const url=Journal.httpsURL(p.photo);if(url){const img=el('img');img.src=url;img.alt='';img.loading='lazy';img.onerror=()=>img.remove();photo.append(img);}label.append(input,photo,el('span',p.name));box.append(label);}
 const missing=pickedHosts.filter(id=>!hostDirectory.some(p=>p.id===id));if(missing.length)$('host-load-status').textContent='Some selected hosts are no longer in the public directory. Please choose the hosts again.';
}
async function loadHosts(){
 if(hostRequest)return hostRequest;
 $('host-load-status').textContent='Loading Common Ground practitioners…';$('reload-hosts').disabled=true;
 hostRequest=(async()=>{try{const result=await api('practitioners');hostDirectory=result.practitioners;$('host-load-status').textContent=hostDirectory.length?'':'No published practitioners are available yet.';renderHostPicker();}catch(e){$('host-load-status').textContent=e.message;}finally{$('reload-hosts').disabled=false;hostRequest=null;}})();return hostRequest;
}
$('reload-hosts').onclick=loadHosts;
function updateLocation(){const online=$('location-type').value==='online';$('location-label').textContent=online?'Meeting link':'Venue or address';$('location-value').type=online?'url':'text';$('location-value').placeholder=online?'Paste your Zoom or other meeting link':'Venue name, street and city';$('location-hint').textContent=online?'Paste a complete https:// meeting link.':'Add the address guests need to find you.';}
$('location-type').onchange=()=>{ $('location-value').value='';updateLocation();};
function editHostLocationContribution(e){
 pickedHosts=JSON.parse(e?.host_ids||'[]');
 // Only preselect exact full-name matches for old prototype events.
 if(!pickedHosts.length&&e?.hosts){const names=e.hosts.split(',').map(n=>n.trim().toLowerCase());pickedHosts=hostDirectory.filter(p=>names.includes(p.name.toLowerCase())).map(p=>p.id);}
 renderHostPicker();loadHosts();
 const f=$('event-form');f.elements.location_type.value=e?.location_type||(e?.location?.startsWith('https://')?'online':'online');updateLocation();
 f.elements.donation_min.value=e?.pricing_mode==='donation'?e.donation_min/100:5;
 f.elements.donation_suggested.value=e?.pricing_mode==='donation'?e.donation_suggested/100:Math.max(5,(e?.price||1500)/100);
 f.elements.donation_max.value=e?.pricing_mode==='donation'?e.donation_max/100:Math.max(30,(e?.price||1500)/100);
}
function saveHostLocationContribution(p){
 if(!pickedHosts.length)throw Error('Select at least one Common Ground practitioner as a host.');
 if(pickedHosts.some(id=>!hostDirectory.some(h=>h.id===id)))throw Error('Choose hosts from the loaded Common Ground directory.');
 const low=Number(p.donation_min),suggested=Number(p.donation_suggested),high=Number(p.donation_max);
 if(!(0<=low&&low<=suggested&&suggested<=high&&high<=10000&&high>=.5)||[low,suggested,high].some(v=>v>0&&v<.5))throw Error('Use minimum ≤ suggested ≤ maximum. Positive contributions start at €0.50.');
 p.host_ids=pickedHosts;p.hosts=hostDirectory.filter(h=>pickedHosts.includes(h.id)).map(h=>h.name).join(', ');p.pricing_mode='donation';p.price=p.donation_suggested;
 if(p.location_type==='online'&&!Journal.httpsURL(p.location))throw Error('Paste a complete HTTPS Zoom or other meeting link.');
}
function eventPrice(e){return e.pricing_mode==='donation'?`Sliding scale ${money(e.donation_min)}–${money(e.donation_max)}`:(JSON.parse(e.tickets||'[]').length?'From '+money(Math.min(...JSON.parse(e.tickets).map(t=>t.price))):money(e.price));}
function showContribution(e){
 const enabled=e.pricing_mode==='donation',input=$('contribution-amount'),slider=$('contribution-slider');
 $('contribution-choice').hidden=!enabled;input.disabled=!enabled;input.required=enabled;slider.disabled=!enabled;
 if(!enabled)return;
 const min=e.donation_min/100,max=e.donation_max/100;
 input.min=slider.min=min;input.max=slider.max=max;input.value=e.donation_suggested/100;input.setCustomValidity('');
 $('contribution-low').textContent=money(e.donation_min);$('contribution-high').textContent=money(e.donation_max);
 function sync(){
  const value=Number(input.value),valid=input.value!==''&&Number.isFinite(value);
  input.setCustomValidity(valid&&value>0&&value<.5?'Choose zero or at least €0.50.':'');
  if(!valid){$('contribution-display').textContent='Choose an amount';return;}
  slider.value=Math.min(max,Math.max(min,value));
  $('contribution-display').textContent=money(Math.round(value*100));
  slider.setAttribute('aria-valuetext',money(Math.round(Number(slider.value)*100)));
  slider.style.setProperty('--progress',(max===min?100:(Number(slider.value)-min)/(max-min)*100)+'%');
 }
 slider.oninput=()=>{let value=Number(slider.value);if(value>0&&value<.5)value=value<.25?0:.5;input.value=value.toFixed(2);sync();};
 input.oninput=sync;
 $('contribution-hint').textContent=`Choose what works for you, from ${money(e.donation_min)} to ${money(e.donation_max)}. Suggested contribution: ${money(e.donation_suggested)}.`;
 $('contribution-presets').replaceChildren();for(const n of [...new Set([e.donation_min,e.donation_suggested,e.donation_max])])$('contribution-presets').append(button(money(n)+(n===e.donation_suggested?' · Suggested':''),()=>{input.value=(n/100).toFixed(2);sync();}));
 sync();
}

refresh().then(()=>openRoute()).catch(e=>$('notice').textContent=e.message);
loadHosts();
