// Shared validation for external practitioner booking pages.
function normalizeBookingUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function bookingButtonHTML(value) {
  const url = normalizeBookingUrl(value);
  if (!url) {
    return `<div class="booking-action"><button type="button" class="btn-book" disabled>Book a session</button><p class="booking-unavailable">Online booking isn’t available yet.</p></div>`;
  }
  const href = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<a class="btn-book" href="${href}" target="_blank" rel="noopener noreferrer">Book a session<span class="visually-hidden"> (opens in a new tab)</span></a>`;
}
