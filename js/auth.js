const tabs = document.querySelectorAll(".auth-tab");
const loginForm = document.getElementById("login-form");
const requestForm = document.getElementById("request-form");
const message = document.getElementById("auth-message");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const isLogin = tab.dataset.tab === "login";
    loginForm.hidden = !isLogin;
    requestForm.hidden = isLogin;
    message.textContent = "";
  });
});

function showMessage(text, isError) {
  message.textContent = text;
  message.className = "auth-message " + (isError ? "is-error" : "is-ok");
}

// If already logged in, skip straight to the dashboard
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) window.location.href = "dashboard.html";
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  showMessage("Logging in…", false);
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showMessage(error.message, true);
    return;
  }
  window.location.href = "dashboard.html";
});

requestForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("request-name").value.trim();
  const email = document.getElementById("request-email").value.trim();
  const msg = document.getElementById("request-message").value.trim();
  showMessage("Sending…", false);

  const { error } = await supabaseClient
    .from("signup_requests")
    .insert({ name, email, message: msg || null });

  if (error) {
    showMessage(error.message, true);
    return;
  }
  requestForm.reset();
  showMessage("Thanks! We'll review your request and email you once you're approved.", false);
});
