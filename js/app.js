// ---- Procedural identity marks ----
// Instead of stock photos, each counselor gets a small generative mark:
// a unique arrangement of overlapping shapes derived from their seed number.
// Deterministic — the same counselor always renders the same mark.
function markSVG(seed) {
  const palette = ["#3F5A48", "#7C9A82", "#5B6E8C", "#B08B4F", "#8C5B6E"];
  const rand = (n) => {
    const x = Math.sin(seed * 999 + n * 37.13) * 10000;
    return x - Math.floor(x);
  };
  const c1 = palette[seed % palette.length];
  const c2 = palette[(seed + 2) % palette.length];
  const cx1 = 20 + rand(1) * 24;
  const cy1 = 20 + rand(2) * 24;
  const r1 = 16 + rand(3) * 10;
  const cx2 = 20 + rand(4) * 24;
  const cy2 = 20 + rand(5) * 24;
  const r2 = 10 + rand(6) * 8;
  // preserveAspectRatio="slice" makes this crop-to-fill any box, the same way
  // object-fit: cover works for a real photo — so the fallback mark and a
  // real photo occupy the exact same space.
  return `
    <svg viewBox="0 0 64 64" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
      <rect width="64" height="64" fill="var(--sand)"/>
      <circle cx="${cx1}" cy="${cy1}" r="${r1}" fill="${c1}" opacity="0.9"/>
      <circle cx="${cx2}" cy="${cy2}" r="${r2}" fill="${c2}" opacity="0.75"/>
    </svg>`;
}

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2);
}

// Renders a real photo if the counselor has a `photo` path set in the data file,
// otherwise falls back to the generated mark.
function avatarHTML(c) {
  if (c.photo) {
    return `<img class="avatar-photo" src="${c.photo}" alt="${c.name}" loading="lazy">`;
  }
  return markSVG(c.seed);
}

// ---- State ----
const state = {
  query: "",
  specialties: new Set(),
  format: "any",
  language: "any",
  sort: "name"
};

const allSpecialties = [...new Set(COUNSELORS.flatMap((c) => c.specialties))].sort();
const allLanguages = [...new Set(COUNSELORS.flatMap((c) => c.languages))].sort();

// ---- Rendering ----
const grid = document.getElementById("counselor-grid");
const emptyState = document.getElementById("empty-state");
const resultCount = document.getElementById("result-count");
const chipRow = document.getElementById("specialty-chips");

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
    c.location.toLowerCase().includes(q) ||
    c.specialties.some((s) => s.toLowerCase().includes(q)) ||
    c.approach.some((a) => a.toLowerCase().includes(q));

  const matchesSpecialty =
    state.specialties.size === 0 ||
    c.specialties.some((s) => state.specialties.has(s));

  const matchesFormat = state.format === "any" || c.formats.includes(state.format);
  const matchesLanguage = state.language === "any" || c.languages.includes(state.language);

  return matchesQuery && matchesSpecialty && matchesFormat && matchesLanguage;
}

function sortList(list) {
  const copy = [...list];
  if (state.sort === "name") {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (state.sort === "availability") {
    const rank = { "Accepting new clients": 0, "1 opening this month": 1, "Waitlist": 2 };
    copy.sort((a, b) => (rank[a.availability] ?? 3) - (rank[b.availability] ?? 3));
  }
  return copy;
}

function cardHTML(c) {
  return `
    <article class="card" data-id="${c.id}" tabindex="0" aria-expanded="false">
      <div class="mark">${avatarHTML(c)}</div>
      <div class="card-heading">
        <h3>${c.name}</h3>
        <p class="credentials">${c.pronouns}</p>
      </div>
      <p class="tagline">${c.bio}</p>
      <ul class="tag-list" aria-label="Specialties">
        ${c.specialties.map((s) => `<li class="tag">${s}</li>`).join("")}
      </ul>
      <div class="meta-row">
        <span class="meta">${c.location}</span>
        <span class="meta dot">${c.formats.join(" / ")}</span>
        <span class="meta dot">${c.priceRange}</span>
        <span class="meta availability ${availabilityClass(c.availability)}">${c.availability}</span>
      </div>
      <div class="card-detail" hidden>
        <p>${c.focus}</p>
        <dl>
          <dt>Approach</dt><dd>${c.approach.join(", ")}</dd>
          <dt>Languages</dt><dd>${c.languages.join(", ")}</dd>
          <dt>Session length</dt><dd>${c.sessionLength}</dd>
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
  const isOpen = !detail.hidden;
  detail.hidden = isOpen;
  card.setAttribute("aria-expanded", String(!isOpen));
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

// ---- Init ----
buildChips();
buildLanguageOptions();
populateBookingSelect();
render();
