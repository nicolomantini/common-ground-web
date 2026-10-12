/* Preview the next three dated invitations; past and undated events stay off home. */
(async () => {
  const list = document.getElementById('home-events');
  const message = document.getElementById('home-events-message');
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  try {
    const [events, profiles] = await Promise.all([
      supabaseClient.from('event_links').select('*').eq('published',true)
        .gt('event_date',today).order('event_date',{ascending:true}).order('created_at',{ascending:false}).limit(3),
      supabaseClient.from('counselors').select('id,name,photo').then(result=>result).catch(()=>({data:[]}))
    ]);
    if (events.error) throw events.error;
    list.replaceChildren();
    for (const event of events.data || []) {
      const card = EventCards.render(event, profiles.data || [], 'h3');
      if (card) list.append(card);
    }
    message.textContent = list.children.length ? '' : 'New events are on their way. Check back soon for our next invitation.';
  } catch {
    message.textContent = 'Upcoming events could not be loaded. Please try again later.';
  }
})();
