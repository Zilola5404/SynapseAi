export interface CookieConsent {
  essential: boolean; // Always true
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
  version: string;
}

const COOKIE_CONSENT_KEY = 'synapse_cookie_consent_v1';

export function getStoredCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function saveCookieConsent(consent: { analytics: boolean; marketing: boolean }): CookieConsent {
  const fullConsent: CookieConsent = {
    essential: true,
    analytics: consent.analytics,
    marketing: consent.marketing,
    updatedAt: new Date().toISOString(),
    version: '1.0',
  };

  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(fullConsent));

  // Initialize analytics dynamically if allowed
  if (consent.analytics) {
    console.log('[CookieConsent] Analytics cookies enabled');
  } else {
    console.log('[CookieConsent] Analytics cookies blocked by user choice');
  }

  return fullConsent;
}

export function acceptAllCookies(): CookieConsent {
  return saveCookieConsent({ analytics: true, marketing: true });
}

export function acceptNecessaryCookies(): CookieConsent {
  return saveCookieConsent({ analytics: false, marketing: false });
}
