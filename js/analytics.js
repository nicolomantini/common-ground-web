// Replace with your real GA4 Measurement ID (Google Analytics → Admin →
// Data Streams → your stream → Measurement ID, looks like "G-XXXXXXXXXX").
const GA_MEASUREMENT_ID = "G-XXXXXXXXXX";

function loadGoogleAnalytics() {
  if (window.gaLoaded || GA_MEASUREMENT_ID.includes("XXXXXXXXXX")) return;
  window.gaLoaded = true;
  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.async = true;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID);
}

function initConsentBanner() {
  const choice = localStorage.getItem("cookie-consent");
  if (choice === "accepted") {
    loadGoogleAnalytics();
    return;
  }
  if (choice === "declined") return;

  const banner = document.createElement("div");
  banner.className = "consent-banner";
  banner.innerHTML = `
    <p>We use Google Analytics to understand site traffic. <a href="privacy.html">Learn more</a>.</p>
    <div class="consent-actions">
      <button type="button" class="btn-text" id="consent-decline">Decline</button>
      <button type="button" class="btn-primary" id="consent-accept">Accept</button>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById("consent-accept").addEventListener("click", () => {
    localStorage.setItem("cookie-consent", "accepted");
    loadGoogleAnalytics();
    banner.remove();
  });
  document.getElementById("consent-decline").addEventListener("click", () => {
    localStorage.setItem("cookie-consent", "declined");
    banner.remove();
  });
}

initConsentBanner();
