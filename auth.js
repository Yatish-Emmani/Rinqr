// ═══════════════════════════════════════════
//   RINQR — auth.js  (v2 — drop in project root)
//   Lightweight localStorage session helper.
//   <script src="auth.js"></script> in every page.
// ═══════════════════════════════════════════

const RINQR_SESSION_KEY = 'rinqr_session';
const SESSION_TTL_MS    = 7 * 24 * 60 * 60 * 1000; // 7 days

const RinqrAuth = {

  save(data) {
    try {
      localStorage.setItem(RINQR_SESSION_KEY, JSON.stringify({ ...data, ts: Date.now() }));
    } catch { /* incognito — fail silently */ }
  },

  get() {
    try {
      const raw = localStorage.getItem(RINQR_SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (Date.now() - (s.ts || 0) > SESSION_TTL_MS) { this.clear(); return null; }
      return s;
    } catch { return null; }
  },

  clear() {
    try { localStorage.removeItem(RINQR_SESSION_KEY); } catch { /* ignore */ }
  },

  // ── Guards ───────────────────────────────

  requireDriver() {
    const s = this.get();
    if (!s || s.accountType !== 'driver') {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace('/signin.html?next=' + next);
      return null;
    }
    return s;
  },

  requireManager() {
    const s = this.get();
    if (!s || s.accountType !== 'manager') {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace('/signin.html?next=' + next);
      return null;
    }
    return s;
  },

  // ── Post-login redirect ──────────────────
  // Reads ?next= param; falls back to session dashboardUrl.
  redirectAfterLogin(session) {
    const params = new URLSearchParams(window.location.search);
    const next   = params.get('next');
    if (next) {
      window.location.replace(decodeURIComponent(next));
    } else {
      window.location.replace(session.dashboardUrl || '/dashboard.html');
    }
  },

  // ── Helpers ──────────────────────────────

  isLoggedIn()   { return !!this.get(); },
  isDriver()     { const s = this.get(); return !!(s && s.accountType === 'driver'); },
  isManager()    { const s = this.get(); return !!(s && s.accountType === 'manager'); },

  signOut() {
    this.clear();
    window.location.replace('/signin.html');
  },
};
