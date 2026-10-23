// Common Ground GA4 web stream. Public measurement ID, not a secret.
const GA_MEASUREMENT_ID = "G-DXM902HMZF";

const analyticsProduction = ['common-ground.space', 'www.common-ground.space'].includes(location.hostname);
function readConsent() { try { return localStorage.getItem('cookie-consent'); } catch { return null; } }
function saveConsent(value) { try { localStorage.setItem('cookie-consent', value); } catch { /* Respect the choice for this page even if storage is blocked. */ } }
function loadGoogleAnalytics() {
  if (!analyticsProduction) return;
  if (window.gaLoaded || GA_MEASUREMENT_ID.includes("XXXXXXXXXX")) return;
  window.gaLoaded = true;
  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.async = true;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {analytics_storage:'granted', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied'});
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
}

function initConsentBanner() {
  const choice = readConsent();
  if (choice === "accepted") {
    loadGoogleAnalytics();
    return;
  }
  if (choice === "declined") return;

  const banner = document.createElement("div");
  banner.className = "consent-banner";
  banner.innerHTML = `
    <p>We use Google Analytics to understand site traffic. <a href="/privacy.html">Learn more</a>.</p>
    <div class="consent-actions">
      <button type="button" class="btn-text" id="consent-decline">Decline</button>
      <button type="button" class="btn-primary" id="consent-accept">Accept</button>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById("consent-accept").addEventListener("click", () => {
    saveConsent("accepted");
    loadGoogleAnalytics();
    banner.remove();
  });
  document.getElementById("consent-decline").addEventListener("click", () => {
    saveConsent("declined");
    banner.remove();
  });
}

document.getElementById('analytics-settings')?.addEventListener('click', () => {
  saveConsent('declined');
  window['ga-disable-' + GA_MEASUREMENT_ID] = true;
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.trim().split('=')[0];
    if (name === '_ga' || name.startsWith('_ga_')) {
      for (const domain of ['', '; domain=' + location.hostname, '; domain=.common-ground.space']) {
        document.cookie = name + '=; Max-Age=0; path=/' + domain;
      }
    }
  }
  location.reload();
});
if (analyticsProduction) initConsentBanner();
