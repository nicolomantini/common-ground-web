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
let REVIEWS_BY_COUNSELOR = {}; // counselor_id -> { avg, count, items: [...] }
let counselorLoadFailed = false;

// ---- Rendering ----
const grid = document.getElementById("counselor-grid");
const emptyState = document.getElementById("empty-state");
const resultCount = document.getElementById("result-count");
const chipRow = document.getElementById("specialty-chips");

async function loadReviews() {
  const { data, error } = await supabaseClient
    .from("reviews")
    .select("*")
    .eq("approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load reviews:", error);
    return;
  }
  REVIEWS_BY_COUNSELOR = {};
  (data || []).forEach((r) => {
    if (!REVIEWS_BY_COUNSELOR[r.counselor_id]) {
      REVIEWS_BY_COUNSELOR[r.counselor_id] = { total: 0, count: 0, items: [] };
    }
    const entry = REVIEWS_BY_COUNSELOR[r.counselor_id];
    entry.total += r.rating;
    entry.count += 1;
    entry.items.push(r);
  });
  Object.values(REVIEWS_BY_COUNSELOR).forEach((entry) => {
    entry.avg = Math.round((entry.total / entry.count) * 10) / 10;
  });
}

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
    throw error;
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

const SOCIAL_ICONS = {
  website: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 6 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-6-3.8-9s1.3-6.3 3.8-9z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15 3h-2.5C10 3 8.5 4.6 8.5 7.2V10H6v3.5h2.5V21h3.6v-7.5H15L15.5 10h-3.4V7.5c0-.9.4-1.5 1.6-1.5H15V3z"/></svg>`,
  linkedin: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="3" y="9" width="3.5" height="12"/><circle cx="4.75" cy="4.75" r="2"/><path d="M10 9h3.4v1.7c.6-1 1.9-2 3.9-2 3 0 4.7 2 4.7 5.6V21h-3.5v-6.1c0-1.6-.6-2.7-2.1-2.7-1.1 0-1.8.8-2.1 1.5-.1.3-.1.6-.1 1V21H10V9z"/></svg>`
};

const SOCIAL_LABELS = { website: "Website", instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn" };

function connectLinksHTML(c) {
  const platforms = ["website", "instagram", "facebook", "linkedin"];
  const links = platforms.filter((p) => c[p]);
  if (links.length === 0) return "";
  return `
    <div class="connect-block">
      <span class="connect-label">Find them online</span>
      <div class="connect-icons">
        ${links
          .map(
            (p) => `
          <a class="connect-icon" href="${c[p]}" target="_blank" rel="noopener noreferrer" aria-label="${c.name} on ${SOCIAL_LABELS[p]}" title="${SOCIAL_LABELS[p]}">
            ${SOCIAL_ICONS[p]}
          </a>`
          )
          .join("")}
      </div>
    </div>`;
}

function reviewSummaryHTML(c) {
  const r = REVIEWS_BY_COUNSELOR[c.id];
  if (!r || r.count === 0) return "";
  return `<span class="meta dot rating-badge">&#9733; ${r.avg} (${r.count})</span>`;
}

function reviewsDetailHTML(c) {
  const r = REVIEWS_BY_COUNSELOR[c.id];
  const items = r ? r.items.slice(0, 3) : [];
  const reviewsHTML = items.length
    ? items.map((rv) => `
        <div class="review-item">
          <span class="review-stars">${"★".repeat(rv.rating)}${"☆".repeat(5 - rv.rating)}</span>
          <p class="review-comment">${rv.comment ? rv.comment : ""}</p>
          <span class="review-author">&mdash; ${rv.name}</span>
        </div>`).join("")
    : `<p class="field-hint">No reviews yet.</p>`;
  return `
    <div class="reviews-block">
      <h4>Reviews</h4>
      ${reviewsHTML}
      <a class="btn-link" href="review.html?counselor=${encodeURIComponent(c.id)}&name=${encodeURIComponent(c.name)}">Leave a review</a>
    </div>`;
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
        ${reviewSummaryHTML(c)}
      </div>
      <div class="detail-actions">
        <button type="button" class="btn-book" data-book="${c.id}">Request a session with ${c.name.split(" ")[0]}</button>
        ${
          c.whatsapp
            ? `<a class="btn-whatsapp" href="https://wa.me/${c.whatsapp}" target="_blank" rel="noopener noreferrer">
                 <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.7 14.2c-.2.6-1.2 1.2-1.7 1.3-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.7-1.2-4.5-3.9-4.6-4.1-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 1-2.2.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .5.4.2.5.7 1.7.7 1.9.1.1.1.3 0 .4-.1.2-.1.3-.3.5l-.4.5c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.4.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1l1.7.8c.2.1.4.2.4.3.1.2.1.9-.1 1.5z"/></svg>
                 WhatsApp
               </a>`
            : ""
        }
      </div>
      <p class="card-toggle" aria-hidden="true">Show more <span class="chev">&#8964;</span></p>
      <div class="card-detail" hidden>
        <dl>
          <dt>Approach</dt><dd>${(c.approach || []).join(", ")}</dd>
          <dt>Languages</dt><dd>${(c.languages || []).join(", ")}</dd>
          <dt>Session length</dt><dd>${c.session_length || ""}</dd>
        </dl>
        ${connectLinksHTML(c)}
        ${reviewsDetailHTML(c)}
      </div>
    </article>`;
}

function availabilityClass(a) {
  if (a === "Accepting new clients") return "is-open";
  if (a === "Waitlist") return "is-waitlist";
  return "is-limited";
}

function render() {
  if (counselorLoadFailed) {
    grid.innerHTML = `<p class="empty-state" role="alert">The counselor directory is temporarily unavailable. Please reload the page to try again.</p>`;
    emptyState.hidden = true;
    resultCount.textContent = "Profiles unavailable";
    document.getElementById("booking-status").textContent = "Session requests are temporarily unavailable while profiles cannot be loaded. Please try again later.";
    return;
  }
  const filtered = sortList(COUNSELORS.filter(matches));
  grid.innerHTML = filtered.map(cardHTML).join("");
  emptyState.hidden = filtered.length !== 0;
  resultCount.textContent = `${filtered.length} practitioner${filtered.length === 1 ? "" : "s"}`;
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
  const available = COUNSELORS.length > 0;
  bookingSelect.disabled = !available;
  document.getElementById("booking-submit").disabled = !available;
  document.getElementById("booking-status").textContent = available
    ? "Choose a practitioner for your request."
    : "Session requests will open when practitioner profiles are available.";
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
  // Reviews are optional: their availability must not block the directory.
  const reviewsLoaded = loadReviews().catch((error) => {
    console.error("Failed to load reviews:", error);
  });
  try {
    await loadCounselors();
    buildChips();
    buildLanguageOptions();
    populateBookingSelect();
  } catch (error) {
    console.error("Failed to load counselors:", error);
    counselorLoadFailed = true;
  }
  render();
  await reviewsLoaded;
  render();
}
init();
