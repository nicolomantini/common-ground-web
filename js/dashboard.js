let currentUser = null;
let existingProfile = null; // null until we know whether one exists
let pendingPhotoFile = null;

const form = document.getElementById("profile-form");
const message = document.getElementById("dash-message");
const statusBadge = document.getElementById("status-badge");
const photoPreview = document.getElementById("photo-preview");

function showMessage(text, isError) {
  message.textContent = text;
  message.className = "dash-message " + (isError ? "is-error" : "is-ok");
}

function csvToArray(value) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function arrayToCsv(arr) {
  return (arr || []).join(", ");
}

async function init() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) {
    window.location.href = "auth.html";
    return;
  }
  currentUser = sessionData.session.user;

  const { data, error } = await supabaseClient
    .from("counselors")
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    showMessage("Couldn't load your profile: " + error.message, true);
    return;
  }

  existingProfile = data;
  if (existingProfile) {
    populateForm(existingProfile);
    document.getElementById("save-btn").textContent = "Save changes";
    statusBadge.hidden = false;
    statusBadge.textContent = existingProfile.approved ? "Live on the site" : "Pending review";
    statusBadge.classList.toggle("is-pending", !existingProfile.approved);
  } else {
    document.getElementById("save-btn").textContent = "Create profile";
    statusBadge.hidden = true;
  }
}

function populateForm(p) {
  document.getElementById("f-name").value = p.name || "";
  document.getElementById("f-pronouns").value = p.pronouns || "";
  document.getElementById("f-location").value = p.location || "";
  document.getElementById("f-bio").value = p.bio || "";
  document.getElementById("f-specialties").value = arrayToCsv(p.specialties);
  document.getElementById("f-approach").value = arrayToCsv(p.approach);
  document.getElementById("f-languages").value = arrayToCsv(p.languages);
  document.getElementById("f-session-length").value = p.session_length || "";
  document.getElementById("f-price-range").value = p.price_range || "$";
  document.getElementById("f-availability").value = p.availability || "Accepting new clients";
  document.getElementById("f-website").value = p.website || "";
  document.getElementById("f-whatsapp").value = p.whatsapp || "";
  document.getElementById("f-instagram").value = p.instagram || "";
  document.getElementById("f-facebook").value = p.facebook || "";
  document.getElementById("f-linkedin").value = p.linkedin || "";
  document.querySelectorAll(".f-format").forEach((cb) => {
    cb.checked = (p.formats || []).includes(cb.value);
  });
  if (p.photo) {
    photoPreview.innerHTML = `<img src="${p.photo}" alt="Current photo">`;
  }
}

document.getElementById("f-photo").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  pendingPhotoFile = file;
  photoPreview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="New photo preview">`;
});

async function uploadPhotoIfNeeded() {
  if (!pendingPhotoFile) return existingProfile?.photo || null;

  const ext = pendingPhotoFile.name.split(".").pop();
  const path = `${currentUser.id}/photo.${ext}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("photos")
    .upload(path, pendingPhotoFile, { upsert: true });

  if (uploadError) throw new Error("Photo upload failed: " + uploadError.message);

  const { data } = supabaseClient.storage.from("photos").getPublicUrl(path);
  return data.publicUrl;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMessage("Saving…", false);

  try {
    const photoUrl = await uploadPhotoIfNeeded();

    const payload = {
      user_id: currentUser.id,
      name: document.getElementById("f-name").value.trim(),
      pronouns: document.getElementById("f-pronouns").value.trim(),
      location: document.getElementById("f-location").value.trim(),
      bio: document.getElementById("f-bio").value.trim(),
      specialties: csvToArray(document.getElementById("f-specialties").value),
      approach: csvToArray(document.getElementById("f-approach").value),
      languages: csvToArray(document.getElementById("f-languages").value),
      formats: [...document.querySelectorAll(".f-format")].filter((cb) => cb.checked).map((cb) => cb.value),
      session_length: document.getElementById("f-session-length").value.trim(),
      price_range: document.getElementById("f-price-range").value,
      availability: document.getElementById("f-availability").value,
      website: document.getElementById("f-website").value.trim() || null,
      whatsapp: document.getElementById("f-whatsapp").value.replace(/\D/g, "") || null,
      instagram: document.getElementById("f-instagram").value.trim() || null,
      facebook: document.getElementById("f-facebook").value.trim() || null,
      linkedin: document.getElementById("f-linkedin").value.trim() || null,
      photo: photoUrl
    };

    let result;
    if (existingProfile) {
      result = await supabaseClient.from("counselors").update(payload).eq("id", existingProfile.id).select().single();
    } else {
      result = await supabaseClient.from("counselors").insert(payload).select().single();
    }

    if (result.error) throw new Error(result.error.message);

    existingProfile = result.data;
    pendingPhotoFile = null;
    document.getElementById("save-btn").textContent = "Save changes";
    statusBadge.hidden = false;
    statusBadge.textContent = existingProfile.approved ? "Live on the site" : "Pending review";
    statusBadge.classList.toggle("is-pending", !existingProfile.approved);

    showMessage(
      existingProfile.approved
        ? "Saved! Your changes are live."
        : "Saved! Your profile is waiting for approval before it appears on the site.",
      false
    );
  } catch (err) {
    showMessage(err.message, true);
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "auth.html";
});

document.getElementById("password-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const passwordMessage = document.getElementById("password-message");
  const newPassword = document.getElementById("new-password").value;
  passwordMessage.textContent = "Updating…";
  passwordMessage.className = "dash-message";
  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
  if (error) {
    passwordMessage.textContent = error.message;
    passwordMessage.className = "dash-message is-error";
    return;
  }
  document.getElementById("new-password").value = "";
  passwordMessage.textContent = "Password updated.";
  passwordMessage.className = "dash-message is-ok";
});

document.getElementById("delete-profile-btn").addEventListener("click", async () => {
  if (!existingProfile) {
    showMessage("You don't have a profile to delete yet.", true);
    return;
  }
  const confirmed = window.confirm(
    "Delete your profile? This can't be undone — your listing will be removed from the site immediately."
  );
  if (!confirmed) return;

  const { error } = await supabaseClient.from("counselors").delete().eq("id", existingProfile.id);
  if (error) {
    showMessage("Couldn't delete your profile: " + error.message, true);
    return;
  }
  window.location.href = "index.html";
});

init();
