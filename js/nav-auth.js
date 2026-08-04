// Include after supabase-client.js on any page that shows the .nav-cta
// login link in the header. If the visitor is already logged in, swaps
// it to point at the dashboard instead of the login page.
(async function () {
  const link = document.querySelector(".nav-cta");
  if (!link) return;
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    link.textContent = "Dashboard";
    link.href = "dashboard.html";
  }
})();
