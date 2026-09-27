(async () => {
  const container = document.getElementById('journal-post');
  const id = new URLSearchParams(location.search).get('id');
  if (!/^[\da-f-]{36}$/i.test(id || '')) {container.textContent = 'This post could not be found.'; return;}
  try {
    const {data,error} = await supabaseClient.from('journal_posts').select('*,counselors(id,name)').eq('id',id).eq('status','published').maybeSingle();
    if(error) throw error;
    if(!data) { container.textContent = 'This post is not available. It may have been unpublished.'; return; }
    document.title = data.title + ' — Common Ground Blog';
    Journal.renderPost(container,data,data.counselors);
  } catch {container.textContent = 'We couldn’t load this post. Please try again later.';}
})();
