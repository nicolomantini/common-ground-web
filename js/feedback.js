let currentUser = null;

const form = document.getElementById("feedback-form");
const formMessage = document.getElementById("feedback-form-message");
const list = document.getElementById("feedback-list");
const emptyNote = document.getElementById("empty-note");

function showFormMessage(text, isError) {
  formMessage.textContent = text;
  formMessage.className = "feedback-message " + (isError ? "is-error" : "is-ok");
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

async function init() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) {
    window.location.href = "auth.html";
    return;
  }
  currentUser = sessionData.session.user;

  // Prefill the name field from their counselor profile, if they have one
  const { data: profile } = await supabaseClient
    .from("counselors")
    .select("name")
    .eq("user_id", currentUser.id)
    .maybeSingle();
  if (profile?.name) {
    document.getElementById("feedback-name").value = profile.name;
  }

  await loadFeedback();
}

async function loadFeedback() {
  const { data, error } = await supabaseClient
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = `<p class="empty-note">Couldn't load feedback: ${error.message}</p>`;
    return;
  }

  emptyNote.hidden = data.length !== 0;
  list.innerHTML = data
    .map(
      (item) => `
    <div class="feedback-item" data-id="${item.id}">
      <div class="feedback-head">
        <span class="feedback-author">${item.author_name}</span>
        <span class="feedback-date">${formatDate(item.created_at)}</span>
      </div>
      <p class="feedback-text">${item.message}</p>
      ${item.user_id === currentUser.id ? `<button type="button" class="feedback-delete" data-id="${item.id}">Delete</button>` : ""}
    </div>`
    )
    .join("");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const author_name = document.getElementById("feedback-name").value.trim();
  const message = document.getElementById("feedback-message").value.trim();
  showFormMessage("Posting…", false);

  const { error } = await supabaseClient.from("feedback").insert({
    user_id: currentUser.id,
    author_name,
    message
  });

  if (error) {
    showFormMessage(error.message, true);
    return;
  }
  document.getElementById("feedback-message").value = "";
  showFormMessage("Posted!", false);
  await loadFeedback();
});

list.addEventListener("click", async (e) => {
  const btn = e.target.closest(".feedback-delete");
  if (!btn) return;
  const confirmed = window.confirm("Delete this feedback?");
  if (!confirmed) return;

  const { error } = await supabaseClient.from("feedback").delete().eq("id", btn.dataset.id);
  if (error) {
    alert("Couldn't delete: " + error.message);
    return;
  }
  await loadFeedback();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "auth.html";
});

init();
