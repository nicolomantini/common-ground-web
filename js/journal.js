(async () => {
  const list = document.getElementById('journal-list');
  const message = document.getElementById('journal-message');
  const category = document.getElementById('journal-category');
  const author = document.getElementById('journal-author');
  const search = document.getElementById('journal-search');
  let posts = [];
  for (const field of [category,author,search]) field.disabled = true;
  function render() {
    const query = search.value.trim().toLowerCase();
    const filtered = posts.filter(p => (!category.value || p.category === category.value) && (!author.value || p.author_id === author.value) && (!query || (p.title + ' ' + Journal.bodyText(p) + ' ' + (p.counselors?.name || '')).toLowerCase().includes(query)));
    list.replaceChildren();
    message.textContent = filtered.length ? `${filtered.length} ${filtered.length === 1 ? 'post' : 'posts'}` : posts.length ? 'No posts match. Try another filter.' : 'Our blog is taking shape. Poems, practices, and conversations will appear here as the collective shares them.';
    for (const post of filtered) {
      const card = Journal.node('article', undefined, 'journal-card');
      const link = Journal.node('a', undefined, 'journal-card-link'); link.href = `blog-post.html?id=${encodeURIComponent(post.id)}`;
      if (Journal.httpsURL(post.cover_url)) { const img = Journal.node('img'); img.src = post.cover_url; img.alt = post.cover_alt || ''; img.loading = 'lazy'; link.append(img); }
      const copy = Journal.node('div', undefined, 'journal-card-copy');
      copy.append(Journal.node('p',post.category,'eyebrow'), Journal.node('h2',post.title));
      const text = Journal.bodyText(post).replace(/\s+/g,' ').trim();
      copy.append(Journal.node('p',text.length > 160 ? text.slice(0,160).trimEnd() + '…' : text,'journal-excerpt'));
      copy.append(Journal.node('span','Read more →','journal-read-more'));
      link.append(copy);
      const byline = Journal.node('div', undefined, 'journal-card-author');
      byline.append(Journal.authorLink(post.counselors));
      card.append(link, byline); list.append(card);
    }
  }
  try {
    const {data,error} = await supabaseClient.from('journal_posts').select('*,counselors(id,name)').eq('status','published').order('published_at',{ascending:false});
    if(error) throw error;
    posts = data || [];
    for (const field of [category,author,search]) field.disabled = false;
    const authors = new Map(posts.filter(p=>p.counselors).map(p=>[p.author_id,p.counselors.name]));
    for(const [id,name] of [...authors].sort((a,b)=>a[1].localeCompare(b[1]))) {const option = Journal.node('option',name); option.value=id; author.append(option);}
    render();
  } catch { message.textContent = 'The blog is not available yet. Please come back soon.'; }
  for (const field of [category,author,search]) field.addEventListener('input',render);
})();
