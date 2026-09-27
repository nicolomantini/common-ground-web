const journalNavToggle = document.getElementById('nav-toggle');
journalNavToggle?.addEventListener('click', () => {
  const open = document.getElementById('header-nav').classList.toggle('is-open');
  journalNavToggle.setAttribute('aria-expanded', String(open));
});
