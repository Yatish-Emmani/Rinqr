// ═══════════════════════════════════════════
//   RINQR — auth.js
//   Lightweight localStorage session helper.
//   Import via: <script src="auth.js"></script>
//
//   Session shape stored under key "rinqr_session":
//   {
//     accountType : 'driver' | 'manager',
//     email       : string,
//     propertyId  : string | null,   // managers only
//     propertyName: string | null,   // managers only
//     dashboardUrl: string,
//     ts          : number,          // login timestamp (ms)
//   }
//
//   Sessions expire after 7 days of inactivity.
// ═══════════════════════════════════════════

const RINQR_SESSION_KEY = 'rinqr_session';
const SESSION_TTL_MS    = 7 * 24 * 60 * 60 * 1000; // 7 days

const RinqrAuth = {

  // ── Write ───────────────────────────────
  save(data) {
    try {
      localStorage.setItem(RINQR_SESSION_KEY, JSON.stringify({
        ...data,
        ts: Date.now(),
      }));
    } catch { /* private/incognito — degrade gracefully */ }
  },

  // ── Read ────────────────────────────────
  get() {
    try {
      const raw = localStorage.getItem(RINQR_SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      // Expire stale sessions
      if (Date.now() - (session.ts || 0) > SESSION_TTL_MS) {
        this.clear();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  // ── Clear ───────────────────────────────
  clear() {
    try { localStorage.removeItem(RINQR_SESSION_KEY); } catch { /* ignore */ }
  },

  // ── Guard: driver pages ─────────────────
  // Call at the top of dashboard.html.
  // Redirects to sign-in if no valid driver session.
  requireDriver() {
    const session = this.get();
    if (!session || session.accountType !== 'driver') {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/signin.html?next=${next}`);
      return null;
    }
    return session;
  },

  // ── Guard: manager pages ────────────────
  // Call at the top of property.html.
  // Redirects to sign-in if no valid manager session.
  requireManager() {
    const session = this.get();
    if (!session || session.accountType !== 'manager') {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/signin.html?next=${next}`);
      return null;
    }
    return session;
  },

  // ── Redirect after login ─────────────────
  // Reads ?next= param and goes there, or falls
  // back to the session's default dashboardUrl.
  redirectAfterLogin(session) {
    const params  = new URLSearchParams(window.location.search);
    const next    = params.get('next');
    const target  = next ? decodeURIComponent(next) : (session.dashboardUrl || '/dashboard.html');
    window.location.replace(target);
  },
};
