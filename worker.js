// ═══════════════════════════════════════════
//   RINQR — Cloudflare Worker Entry Point
//   Routes all /api/* requests to the correct
//   handler, then falls back to static assets.
// ═══════════════════════════════════════════

import { onRequestPost as pilotRequest   } from './functions/api/pilot-request.js';
import { onRequestPost as activate       } from './functions/api/activate.js';
import { onRequestGet  as propertyLookup } from './functions/api/property-lookup.js';
import { onRequestPost as sendMessage    } from './functions/api/send-message.js';
import { onRequestPost as createProperty } from './functions/api/admin/create-property.js';
import { onRequestGet  as propertyStats  } from './functions/api/property/[id]/stats.js';
import { onRequestPost as signin         } from './functions/api/signin.js';
import { onRequestPost as signup         } from './functions/api/signup.js';
import { onRequestPost as verifyOtp      } from './functions/api/auth/verify-otp.js';

export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // Helper: build a context object matching the Pages Functions signature
    const c = (params = {}) => ({ request, env, ctx, params });

    // ── CORS preflight ────────────────────────────────────────
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin':  '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
        },
      });
    }

    // ── API routes ────────────────────────────────────────────
    if (path === '/api/pilot-request'           && method === 'POST') return pilotRequest(c());
    if (path === '/api/activate'                && method === 'POST') return activate(c());
    if (path === '/api/property-lookup'         && method === 'GET')  return propertyLookup(c());
    if (path === '/api/send-message'            && method === 'POST') return sendMessage(c());
    if (path === '/api/admin/create-property'   && method === 'POST') return createProperty(c());
    if (path === '/api/signin'                  && method === 'POST') return signin(c());
    if (path === '/api/signup'                  && method === 'POST') return signup(c());
    if (path === '/api/auth/verify-otp'         && method === 'POST') return verifyOtp(c());

    // Dynamic: /api/property/:id/stats
    const statsMatch = path.match(/^\/api\/property\/([^/]+)\/stats$/);
    if (statsMatch && method === 'GET') {
      return propertyStats(c({ id: statsMatch[1] }));
    }

    // ── Static assets (HTML, CSS, images) ────────────────────
    return env.ASSETS.fetch(request);
  },
};
