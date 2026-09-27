(async () => {
  const $ = id => document.getElementById(id);
  const form = $('journal-form'), message = $('editor-message');
  let user, author, posts = [], current = null, coverURL = null, localCover = null, dirty = false, busy = false;
  const tell = text => {message.textContent = text;};
  const setBusy = value => {busy = value; WritingEditor.disable(value); form.querySelectorAll('input,textarea,select,button').forEach(e=>e.disabled=value); $('new-post').disabled=value; $('editor-posts').querySelectorAll('button').forEach(e=>e.disabled=value);};
  function values() {
    return {title:$('j-title').value.trim(),category:$('j-category').value,body:$('j-body').value,body_format:'html',cover_url:coverURL,cover_alt:$('j-alt').value.trim(),video_url:Journal.httpsURL($('j-video').value.trim())};
  }
  function validateVideo() {
    $('j-video').setCustomValidity($('j-video').value.trim() && !Journal.videoEmbed($('j-video').value.trim()) ? 'Enter a valid HTTPS YouTube video link.' : '');
  }
  function clearLocalCover() {if(localCover) URL.revokeObjectURL(localCover); localCover=null;}
  function updateCoverPreview() {
    $('cover-preview').hidden = !(localCover || coverURL);
    if(localCover || coverURL) $('cover-preview').src = localCover || coverURL;
    else $('cover-preview').removeAttribute('src');
  }
  function edit(post) {
    if(busy || (dirty && !confirm('Discard your unsaved changes?'))) return;
    current = post || null; form.reset(); clearLocalCover(); coverURL=post?.cover_url || null;
    $('j-title').value=post?.title || ''; $('j-category').value=post?.category || Journal.categories[0];
    WritingEditor.set(post); $('j-alt').value=post?.cover_alt || ''; $('j-video').value=post?.video_url || '';
    $('editing-label').textContent=post ? `${post.status === 'published' ? 'Published' : 'Draft'} · ${post.counselors?.name || author.name}` : 'New draft';
    form.querySelector('[value="published"]').textContent=post?.status==='published' ? 'Update published post' : 'Publish';
    validateVideo(); updateCoverPreview(); dirty=false;
  }
  async function loadPosts(isEditor) {
    let query=supabaseClient.from('journal_posts').select('*,counselors(id,name)').order('updated_at',{ascending:false});
    if(!isEditor) query=query.eq('author_id',author.id);
    const {data,error}=await query; if(error) throw error; posts=data || [];
    $('editor-posts').replaceChildren();
    if(!posts.length) $('editor-posts').append(Journal.node('p','Your first post starts here.'));
    for(const post of posts) {
      const button=Journal.node('button',`${post.title} · ${post.status}${isEditor ? ' · ' + (post.counselors?.name || 'Member') : ''}`,'btn-text');
      button.type='button'; button.addEventListener('click',()=>edit(post)); $('editor-posts').append(button);
    }
  }
  let isEditor=false;
  try {
    const {data,error}=await supabaseClient.auth.getUser(); if(error || !data.user) {location.href='auth.html'; return;} user=data.user;
    const profile=await supabaseClient.from('counselors').select('id,name').eq('user_id',user.id).maybeSingle();
    if(profile.error) throw profile.error;
    if(!profile.data) {tell('Please create your practitioner profile in the dashboard before writing for the blog.');return;}
    author=profile.data;
    const role=await supabaseClient.from('journal_editors').select('user_id').eq('user_id',user.id).maybeSingle();
    if(role.error) throw role.error; isEditor=!!role.data;
    await loadPosts(isEditor); $('journal-workspace').hidden=false; tell(isEditor ? 'You can manage all blog posts.' : 'You can manage your own posts.'); edit(null);
  } catch {tell('Blog editing is not available yet. Please contact Nico to finish setting it up.'); return;}
  form.addEventListener('input',()=>{dirty=true;});
  $('j-video').addEventListener('input',validateVideo);
  $('new-post').addEventListener('click',()=>edit(null));
  $('j-cover').addEventListener('change',()=>{
    const file=$('j-cover').files[0]; clearLocalCover(); dirty=true;
    if(file && (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>5242880)) {$('j-cover').value='';tell('Choose a JPEG, PNG, or WebP image smaller than 5 MB.');}
    else if(file) localCover=URL.createObjectURL(file);
    updateCoverPreview();
  });
  $('remove-cover').addEventListener('click',()=>{coverURL=null;clearLocalCover();$('j-cover').value='';updateCoverPreview();dirty=true;});
  $('preview-post').addEventListener('click',()=>{
    WritingEditor.sync(); validateVideo(); if(!form.reportValidity()) return;
    if($('j-body').value.length>30000){tell('Please shorten the post before previewing.');return;}
    const post=values(); Journal.renderPost($('preview-content'),post,current?.counselors || author,true);
    if(localCover) {let img=$('preview-content').querySelector('.journal-cover'); if(!img){img=Journal.node('img',undefined,'journal-cover');$('preview-content').querySelector('.journal-body').before(img);}img.src=localCover;img.alt=post.cover_alt;}
    $('journal-preview').showModal(); $('journal-preview').scrollTop=0; document.body.classList.add('profile-is-open');
  });
  $('close-preview').addEventListener('click',()=>$('journal-preview').close());
  $('journal-preview').addEventListener('close',()=>document.body.classList.remove('profile-is-open'));
  form.addEventListener('submit',async e=>{
    e.preventDefault(); if(busy) return; WritingEditor.sync(); validateVideo(); if(!form.reportValidity())return;
    if($('j-body').value.length>30000){tell('Please shorten the post before saving.');return;}
    if (!$('j-title').value.trim()) {tell('Please give your post a title.'); $('j-title').focus(); return;}
    const status=e.submitter?.value || 'draft';
    if(status==='published' && !WritingEditor.text() && !$('j-video').value.trim()){tell('Add some text or a video before publishing.');return;}
    setBusy(true);tell('Saving…');
    try {
      const file=$('j-cover').files[0];
      if(file) {
        const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
        const path=`${user.id}/${crypto.randomUUID()}.${extension}`;
        const upload=await supabaseClient.storage.from('journal-covers').upload(path,file,{contentType:file.type});
        if(upload.error)throw upload.error;
        coverURL=supabaseClient.storage.from('journal-covers').getPublicUrl(path).data.publicUrl;
        // Retain the successful upload if saving the post needs a retry.
        $('j-cover').value='';clearLocalCover();updateCoverPreview();
      }
      const payload={...values(),status};
      let query=current ? supabaseClient.from('journal_posts').update(payload).eq('id',current.id) : supabaseClient.from('journal_posts').insert({...payload,author_id:author.id});
      const result=await query.select().single(); if(result.error)throw result.error;
      current={...result.data,counselors:current?.counselors || author}; dirty=false;
      await loadPosts(isEditor);
      setBusy(false); edit(current);
      tell(status==='published'?'Published! Your post is live in the blog.':'Draft saved. It is not visible in the blog.');
    } catch {tell('Could not save the post. Your changes are still here—please try again.');}
    finally {setBusy(false);}
  });
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
})();
