const tabs = document.querySelectorAll(".auth-tab");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const message = document.getElementById("auth-message");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const isLogin = tab.dataset.tab === "login";
    loginForm.hidden = !isLogin;
    signupForm.hidden = isLogin;
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

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  showMessage("Creating your account…", false);
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    showMessage(error.message, true);
    return;
  }
  showMessage(
    "Account created. If email confirmation is enabled on this project, check your inbox before logging in — otherwise you can log in right away.",
    false
  );
});
