(async () => {
  const $ = id => document.getElementById(id);
  const node = Journal.node;
  let user = null, current = null, busy = false, dirty = false;
  const form = $('event-form');
  let practitioners = [], selectedHosts = [], coverURL = null, pendingPhoto = null, previewURL = null, extrasReady = false;
  const avatar = EventCards.avatar;
  function hostOptions() {
    $('event-host-options').replaceChildren();
    for(const person of practitioners) {
      const label=node('label',undefined,'event-host-choice');
      const input=node('input');input.type='checkbox'; input.value=person.id; input.checked=selectedHosts.includes(person.id);
      input.addEventListener('change',()=>{selectedHosts=[...$('event-host-options').querySelectorAll('input:checked')].map(el=>el.value);});
      label.append(input,avatar(person),node('span',person.name));$('event-host-options').append(label);
    }
    if(!practitioners.length)$('event-host-options').append(node('p','No practitioner profiles are available yet.'));
  }
  function previewPhoto() {
    const image=$('event-photo-preview'); const url=previewURL || coverURL;
    image.hidden=!url;if(url)image.src=url;else image.removeAttribute('src');
  }
  function clearPreview() {if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;}
  function extraControls() {
    [$('event-host-field'),$('event-photo'),$('event-photo-remove')].forEach(el=>el.disabled=!extrasReady || busy);
  }
  $('event-photo').addEventListener('change',()=>{
    const file=$('event-photo').files[0];
    clearPreview();pendingPhoto=null;
    if(file && (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>5242880)) {
      $('event-photo').value='';$('event-extras-message').textContent='Choose a JPEG, PNG or WebP image smaller than 5 MB.';
    } else {pendingPhoto=file || null;if(file)previewURL=URL.createObjectURL(file);$('event-extras-message').textContent='';}
    previewPhoto();
  });
  $('event-photo-remove').addEventListener('click',()=>{clearPreview();pendingPhoto=null;coverURL=null;$('event-photo').value='';dirty=true;previewPhoto();});
  function edit(event) {
    if (busy || (dirty && !confirm('Discard unsaved changes?'))) return;
    current = event?.id || null;
    form.reset();
    selectedHosts=event?.host_ids || [];coverURL=event?.cover_url || null;pendingPhoto=null;clearPreview();
    hostOptions();previewPhoto();extraControls();
    $('event-title').value = event?.title || '';
    $('event-url').value = event?.url || '';
    $('event-description').value = event?.description || '';
    $('event-date').value = event?.event_date || '';
    $('event-published').checked = event ? event.published : true;
    $('event-url').setCustomValidity('');
    $('event-save-message').textContent = '';
    dirty = false;
  }
  async function loadPublic() {
    const {data, error} = await supabaseClient.from('event_links').select('*').eq('published', true).order('event_date', {ascending:false, nullsFirst:false}).order('created_at', {ascending:false});
    if (error) throw error;
    $('event-links').replaceChildren();
    for (const event of data || []) {
      const card = EventCards.render(event, practitioners);
      if (card) $('event-links').append(card);
    }
    $('events-message').textContent = $('event-links').children.length ? '' : 'New invitations will appear here soon.';
  }
  async function loadOwn() {
    const {data,error} = await supabaseClient.from('event_links').select('*').eq('user_id',user.id).order('created_at',{ascending:false});
    if(error) throw error;
    $('own-events').replaceChildren();
    for(const event of data || []) {
      const button = node('button', `${event.title} · ${event.published ? 'Visible' : 'Hidden'}`, 'btn-text');
      button.type = 'button'; button.addEventListener('click',()=>edit(event)); $('own-events').append(button);
    }
  }
  $('new-event').addEventListener('click',()=>edit(null));
  form.addEventListener('input',()=>{dirty=true; $('event-url').setCustomValidity('');});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  form.addEventListener('submit',async e=>{
    e.preventDefault(); if(busy || !user) return;
    const url = Journal.httpsURL($('event-url').value.trim());
    $('event-url').setCustomValidity(url ? '' : 'Use a complete HTTPS link without a username or password.');
    if(!form.reportValidity()) return;
    const payload = {title:$('event-title').value.trim(),url,description:$('event-description').value.trim(),event_date:$('event-date').value || null,published:$('event-published').checked};
    if(!payload.title){$('event-save-message').textContent='Please enter an event title.';return;}
    if(selectedHosts.length>8){$('event-save-message').textContent='Select up to eight hosts.';return;}
    busy=true;extraControls(); document.querySelectorAll('#event-manager input,#event-manager textarea,#event-manager button').forEach(el=>el.disabled=true);
    $('event-save-message').textContent='Saving…';
    try {
      if(extrasReady) {
        if(pendingPhoto) {
          const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[pendingPhoto.type];
          const path=`${user.id}/${crypto.randomUUID()}.${extension}`;
          const upload=await supabaseClient.storage.from('event-covers').upload(path,pendingPhoto,{contentType:pendingPhoto.type,upsert:false});
          if(upload.error)throw upload.error;
          coverURL=supabaseClient.storage.from('event-covers').getPublicUrl(path).data.publicUrl;
          pendingPhoto=null;clearPreview();$('event-photo').value='';previewPhoto();
        }
        Object.assign(payload,{host_ids:selectedHosts,cover_url:coverURL});
      }
      const result = current ? await supabaseClient.from('event_links').update(payload).eq('id',current).eq('user_id',user.id).select('id').single() : await supabaseClient.from('event_links').insert({...payload,user_id:user.id}).select('id').single();
      if(result.error) throw result.error;
      current=result.data.id; dirty=false;
      $('event-save-message').textContent=payload.published ? 'Saved. Your event is visible.' : 'Saved. Your event is hidden.';
      try {await Promise.all([loadPublic(),loadOwn()]);} catch {$('event-save-message').textContent='Saved, but the list could not refresh. Reload the page to see it.';}
    } catch {$('event-save-message').textContent='Could not save. Your changes are still here; please try again.';}
    finally {busy=false;document.querySelectorAll('#event-manager input,#event-manager textarea,#event-manager button').forEach(el=>el.disabled=false);extraControls();}
  });
  try {
    const profiles=await supabaseClient.from('counselors').select('id,name,photo').order('name');
    if(profiles.error)throw profiles.error;
    practitioners=profiles.data || [];
  } catch { /* Event links remain usable when host profiles cannot be loaded. */ }
  try {await loadPublic();} catch {$('events-message').textContent='Events are temporarily unavailable. Please try again later.';}
  try {
    const {data,error}=await supabaseClient.auth.getUser(); if(error || !data.user)return;
    user=data.user;
    const profile=await supabaseClient.from('counselors').select('id').eq('user_id',user.id).maybeSingle();
    if(profile.error)throw profile.error;
    if(!profile.data){$('events-login').textContent='A Common Ground practitioner profile is needed to share events.';return;}
    const probe=await supabaseClient.from('event_links').select('host_ids,cover_url,cover_alt').limit(0);
    extrasReady=!probe.error;
    if(!extrasReady)$('event-extras-message').textContent='Host selection and images will be available after the event setup is updated.';
    hostOptions();extraControls();
    await loadOwn(); $('event-manager').hidden=false; $('events-login').hidden=true;
  } catch {$('events-login').textContent='Event editing is not available yet. Please contact Nico.';}
})();
