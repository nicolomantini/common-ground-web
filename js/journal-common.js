/* Shared safe rendering for public posts and the editor's preview. */
const Journal = (() => {
  const categories = ['Poems & reflections', 'Practices', 'Conversations'];
  function httpsURL(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; }
    catch { return null; }
  }
  function videoEmbed(value) {
    const safe = httpsURL(value);
    if (!safe) return null;
    const u = new URL(safe);
    let id;
    if (['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname)) {
      id = u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(?:shorts|embed)\/([^/]+)\/?$/.exec(u.pathname)?.[1];
    } else if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
    return /^[\w-]{11}$/.test(id || '') ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function authorLink(author) {
    const el = node('a', author?.name || 'Common Ground');
    el.href = author?.id ? `index.html?practitioner=${encodeURIComponent(author.id)}#directory` : 'index.html#directory';
    return el;
  }
  function cleanHTML(value) {
    const parsed = new DOMParser().parseFromString(String(value || ''), 'text/html');
    const allowed = new Set(['P','DIV','BR','STRONG','B','EM','I','U','H2','H3','UL','OL','LI','BLOCKQUOTE','PRE']);
    function clean(parent) {
      for (const child of [...parent.childNodes]) {
        if (child.nodeType === 3) continue;
        if (child.nodeType !== 1) { child.remove(); continue; }
        if (['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','TEMPLATE'].includes(child.tagName)) {child.remove();continue;}
        clean(child);
        if (!allowed.has(child.tagName)) {child.replaceWith(...child.childNodes);continue;}
        const align = child.style.textAlign || (child.classList.contains('ql-align-center') ? 'center' : child.classList.contains('ql-align-right') ? 'right' : '');
        for(const attribute of [...child.attributes]) child.removeAttribute(attribute.name);
        if (['left','center','right'].includes(align)) child.style.textAlign = align;
      }
    }
    clean(parsed.body);
    return parsed.body.innerHTML;
  }
  function bodyText(post) {
    if(post.body_format !== 'html') return post.body || '';
    const parsed = new DOMParser().parseFromString(cleanHTML(post.body),'text/html');
    parsed.body.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
    parsed.body.querySelectorAll('p,div,h2,h3,li,blockquote,pre').forEach(el => el.append('\n'));
    return parsed.body.textContent;
  }
  function renderPost(container, post, author, preview = false) {
    container.replaceChildren();
    container.append(node('p', post.category, 'eyebrow'), node('h1', post.title));
    const meta = node('p', undefined, 'journal-meta');
    meta.append(authorLink(author));
    if (post.published_at) meta.append(document.createTextNode(' · ' + new Date(post.published_at).toLocaleDateString(undefined, {year:'numeric',month:'long',day:'numeric'})));
    container.append(meta);
    if (httpsURL(post.cover_url)) {
      const img = node('img', undefined, 'journal-cover'); img.src = post.cover_url; img.alt = post.cover_alt || ''; container.append(img);
    }
    const body = node('div', undefined, 'journal-body');
    if(post.body_format === 'html') body.innerHTML = cleanHTML(post.body);
    else body.textContent = post.body || '';
    container.append(body);
    const embed = videoEmbed(post.video_url);
    if (embed) {
      const wrapper = node('div', undefined, 'journal-video');
      const button = node('button', preview ? 'Play video preview' : 'Play video', 'btn-primary');
      const note = node('p', 'Playing loads YouTube content and connects to Google.','form-note');
      button.type = 'button';
      button.addEventListener('click', () => {
        const iframe = node('iframe'); iframe.src = embed; iframe.title = post.title + ' — video'; iframe.allow = 'encrypted-media; picture-in-picture; fullscreen'; iframe.allowFullscreen = true; iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        wrapper.replaceChildren(iframe);
      });
      wrapper.append(button, note); container.append(wrapper);
    }
  }
  return { cleanHTML, bodyText, categories, httpsURL, videoEmbed, node, authorLink, renderPost };
})();
if (typeof module !== 'undefined') module.exports = Journal;
