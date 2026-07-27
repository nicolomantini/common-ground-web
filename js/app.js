// ---- Procedural identity marks ----
// Instead of stock photos, each counselor gets a small generative mark:
// a unique arrangement of overlapping shapes derived from their seed number.
// Deterministic — the same counselor always renders the same mark.
// Generic placeholder avatar shown for any counselor without a `photo` set.
// Same neutral graphic for everyone — a simple silhouette on a soft background.
function placeholderAvatarSVG() {
  return `
    <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
      <rect width="100" height="100" fill="var(--sand)"/>
      <circle cx="50" cy="40" r="16" fill="var(--moss-light)"/>
      <path d="M18 92c3-22 16-34 32-34s29 12 32 34z" fill="var(--moss-light)"/>
    </svg>`;
}

// Renders a real photo if the counselor has a `photo` path set in the data file,
// otherwise falls back to the generic placeholder avatar.
function avatarHTML(c) {
  if (c.photo) {
    return `<img class="avatar-photo" src="${c.photo}" alt="${c.name}" loading="lazy">`;
  }
  return placeholderAvatarSVG();
}

// ---- State ----
const state = {
  query: "",
  specialties: new Set(),
  format: "any",
  language: "any",
  sort: "name"
};

let COUNSELORS = [];
let allSpecialties = [];
let allLanguages = [];

// ---- Rendering ----
const grid = document.getElementById("counselor-grid");
const emptyState = document.getElementById("empty-state");
const resultCount = document.getElementById("result-count");
const chipRow = document.getElementById("specialty-chips");

// Fetches every APPROVED profile from Supabase. Row Level Security on the
// `counselors` table means the anon key used here can only ever see rows
// where approved = true — unapproved profiles are invisible to the public
// site no matter what, even if this code changes.
async function loadCounselors() {
  const { data, error } = await supabaseClient
    .from("counselors")
    .select("*")
    .eq("approved", true);

  if (error) {
    console.error("Failed to load counselors:", error);
    grid.innerHTML = `<p class="empty-state">Couldn't load counselors right now. Please try again shortly.</p>`;
    return;
  }
  COUNSELORS = data || [];
  allSpecialties = [...new Set(COUNSELORS.flatMap((c) => c.specialties || []))].sort();
  allLanguages = [...new Set(COUNSELORS.flatMap((c) => c.languages || []))].sort();
}

function buildLanguageOptions() {
  const select = document.getElementById("language-select");
  allLanguages.forEach((lang) => {
    const opt = document.createElement("option");
    opt.value = lang;
    opt.textContent = lang;
    select.appendChild(opt);
  });
}

function buildChips() {
  chipRow.innerHTML = allSpecialties
    .map(
      (s) => `<button type="button" class="chip" data-specialty="${s}" aria-pressed="false">${s}</button>`
    )
    .join("");
}

function matches(c) {
  const q = state.query.trim().toLowerCase();
  const matchesQuery =
    !q ||
    c.name.toLowerCase().includes(q) ||
    (c.location || "").toLowerCase().includes(q) ||
    (c.specialties || []).some((s) => s.toLowerCase().includes(q)) ||
    (c.approach || []).some((a) => a.toLowerCase().includes(q));

  const matchesSpecialty =
    state.specialties.size === 0 ||
    (c.specialties || []).some((s) => state.specialties.has(s));

  const matchesFormat = state.format === "any" || (c.formats || []).includes(state.format);
  const matchesLanguage = state.language === "any" || (c.languages || []).includes(state.language);

  return matchesQuery && matchesSpecialty && matchesFormat && matchesLanguage;
}

function sortList(list) {
  const copy = [...list];
  const sortWithinGroup = (a, b) => {
    if (state.sort === "name") {
      return a.name.localeCompare(b.name);
    }
    if (state.sort === "availability") {
      const rank = { "Accepting new clients": 0, "1 opening this month": 1, "Waitlist": 2 };
      return (rank[a.availability] ?? 3) - (rank[b.availability] ?? 3);
    }
    return 0;
  };
  copy.sort((a, b) => {
    // Real, signed-up counselors (user_id set) come before demo/admin-added
    // profiles (user_id null), regardless of the chosen sort order.
    const aReal = a.user_id ? 0 : 1;
    const bReal = b.user_id ? 0 : 1;
    if (aReal !== bReal) return aReal - bReal;
    return sortWithinGroup(a, b);
  });
  return copy;
}

function cardHTML(c) {
  return `
    <article class="card" data-id="${c.id}" tabindex="0" aria-expanded="false">
      <div class="mark">${avatarHTML(c)}</div>
      <div class="card-heading">
        <h3>${c.name}</h3>
        <p class="credentials">${c.pronouns || ""}</p>
      </div>
      <p class="tagline">${c.bio || ""}</p>
      <ul class="tag-list" aria-label="Specialties">
        ${(c.specialties || []).map((s) => `<li class="tag">${s}</li>`).join("")}
      </ul>
      <div class="meta-row">
        <span class="meta">${c.location || ""}</span>
        <span class="meta dot">${(c.formats || []).join(" / ")}</span>
        <span class="meta dot">${c.price_range || ""}</span>
        <span class="meta availability ${availabilityClass(c.availability)}">${c.availability || ""}</span>
      </div>
      <p class="card-toggle" aria-hidden="true">Show more <span class="chev">&#8964;</span></p>
      <div class="card-detail" hidden>
        <p>${c.focus || ""}</p>
        <dl>
          <dt>Approach</dt><dd>${(c.approach || []).join(", ")}</dd>
          <dt>Languages</dt><dd>${(c.languages || []).join(", ")}</dd>
          <dt>Session length</dt><dd>${c.session_length || ""}</dd>
        </dl>
        <div class="detail-actions">
          <button type="button" class="btn-book" data-book="${c.id}">Request a session with ${c.name.split(" ")[0]}</button>
          ${c.website ? `<a class="btn-link" href="${c.website}" target="_blank" rel="noopener noreferrer">Visit website ↗</a>` : ""}
        </div>
      </div>
    </article>`;
}

function availabilityClass(a) {
  if (a === "Accepting new clients") return "is-open";
  if (a === "Waitlist") return "is-waitlist";
  return "is-limited";
}

function render() {
  const filtered = sortList(COUNSELORS.filter(matches));
  grid.innerHTML = filtered.map(cardHTML).join("");
  emptyState.hidden = filtered.length !== 0;
  resultCount.textContent = `${filtered.length} counselor${filtered.length === 1 ? "" : "s"}`;
}

// ---- Events ----
chipRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  const s = btn.dataset.specialty;
  if (state.specialties.has(s)) {
    state.specialties.delete(s);
    btn.setAttribute("aria-pressed", "false");
    btn.classList.remove("chip-active");
  } else {
    state.specialties.add(s);
    btn.setAttribute("aria-pressed", "true");
    btn.classList.add("chip-active");
  }
  render();
});

document.getElementById("search-input").addEventListener("input", (e) => {
  state.query = e.target.value;
  render();
});

document.getElementById("format-select").addEventListener("change", (e) => {
  state.format = e.target.value;
  render();
});

document.getElementById("language-select").addEventListener("change", (e) => {
  state.language = e.target.value;
  render();
});

document.getElementById("sort-select").addEventListener("change", (e) => {
  state.sort = e.target.value;
  render();
});

document.getElementById("clear-filters").addEventListener("click", () => {
  state.query = "";
  state.specialties.clear();
  state.format = "any";
  state.language = "any";
  state.sort = "name";
  document.getElementById("search-input").value = "";
  document.getElementById("format-select").value = "any";
  document.getElementById("language-select").value = "any";
  document.getElementById("sort-select").value = "name";
  chipRow.querySelectorAll(".chip").forEach((c) => {
    c.setAttribute("aria-pressed", "false");
    c.classList.remove("chip-active");
  });
  render();
});

// Expand / collapse a card, and route the booking button
grid.addEventListener("click", (e) => {
  if (e.target.closest("a[href]")) return;
  const bookBtn = e.target.closest("[data-book]");
  if (bookBtn) {
    openBooking(bookBtn.dataset.book);
    return;
  }
  const card = e.target.closest(".card");
  if (!card) return;
  toggleCard(card);
});

grid.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest(".card");
  if (!card) return;
  e.preventDefault();
  toggleCard(card);
});

function toggleCard(card) {
  const detail = card.querySelector(".card-detail");
  const toggleLabel = card.querySelector(".card-toggle");
  const isOpen = !detail.hidden;
  detail.hidden = isOpen;
  card.setAttribute("aria-expanded", String(!isOpen));
  if (toggleLabel) {
    toggleLabel.innerHTML = isOpen
      ? `Show more <span class="chev">&#8964;</span>`
      : `Show less <span class="chev">&#8964;</span>`;
  }
}

// ---- Booking panel ----
const bookingSection = document.getElementById("booking");
const bookingSelect = document.getElementById("booking-counselor");

function populateBookingSelect() {
  bookingSelect.innerHTML = COUNSELORS.map(
    (c) => `<option value="${c.name}">${c.name} — ${c.specialties.join(", ")}</option>`
  ).join("");
}

function openBooking(id) {
  const c = COUNSELORS.find((x) => x.id === id);
  if (c) bookingSelect.value = c.name;
  bookingSection.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("booking-name").focus({ preventScroll: true });
}

document.getElementById("scroll-to-directory").addEventListener("click", () => {
  document.getElementById("directory").scrollIntoView({ behavior: "smooth", block: "start" });
});

// ---- Mobile nav toggle ----
const navToggle = document.getElementById("nav-toggle");
const headerNav = document.getElementById("header-nav");
navToggle.addEventListener("click", () => {
  const isOpen = headerNav.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});
headerNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    headerNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

// ---- Init ----
async function init() {
  resultCount.textContent = "Loading…";
  await loadCounselors();
  buildChips();
  buildLanguageOptions();
  populateBookingSelect();
  render();
}
init();
