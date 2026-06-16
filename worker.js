import { onRequestPost as pilotRequest    } from './functions/api/pilot-request.js';
import { onRequestPost as activate        } from './functions/api/activate.js';
import { onRequestGet  as propertyLookup  } from './functions/api/property-lookup.js';
import { onRequestPost as sendMessage     } from './functions/api/send-message.js';
import { onRequestPost as createProperty  } from './functions/api/admin/create-property.js';
import { onRequestPost as generateTags    } from './functions/api/admin/generate-tags.js';
import { onRequestGet  as propertyStats   } from './functions/api/property/[id]/stats.js';
import { onRequestPost as signin          } from './functions/api/signin.js';
import { onRequestPost as signup          } from './functions/api/signup.js';
import { onRequestPost as verifyOtp       } from './functions/api/auth/verify-otp.js';
import { onRequestGet  as tags            } from './functions/api/tags.js';
import { onRequestPost as toggleTag       } from './functions/api/tags/toggle.js';
import { onRequestGet  as scans           } from './functions/api/scans.js';
import { onRequestPost as profile         } from './functions/api/profile.js';
import { onRequestPost as resetPassword   } from './functions/api/auth/reset-password.js';

export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;
    const c = (params = {}) => ({ request, env, ctx, params });

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin':  '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
        },
      });
    }

    // ── API routes ────────────────────────────────────────
    if (path === '/api/pilot-request'               && method === 'POST') return pilotRequest(c());
    if (path === '/api/activate'                    && method === 'POST') return activate(c());
    if (path === '/api/property-lookup'             && method === 'GET')  return propertyLookup(c());
    if (path === '/api/send-message'                && method === 'POST') return sendMessage(c());
    if (path === '/api/admin/create-property'       && method === 'POST') return createProperty(c());
    if (path === '/api/admin/generate-tags'         && method === 'POST') return generateTags(c());
    if (path === '/api/signin'                      && method === 'POST') return signin(c());
    if (path === '/api/signup'                      && method === 'POST') return signup(c());
    if (path === '/api/auth/verify-otp'             && method === 'POST') return verifyOtp(c());
    if (path === '/api/auth/reset-password'         && method === 'POST') return resetPassword(c());
    if (path === '/api/auth/reset-password/confirm' && method === 'POST') return resetPassword(c());
    if (path === '/api/tags'                        && method === 'GET')  return tags(c());
    if (path === '/api/tags/toggle'                 && method === 'POST') return toggleTag(c());
    if (path === '/api/scans'                       && method === 'GET')  return scans(c());
    if (path === '/api/profile'                     && method === 'POST') return profile(c());

    // Dynamic: /api/property/:id/stats
    const statsMatch = path.match(/^\/api\/property\/([^/]+)\/stats$/);
    if (statsMatch && method === 'GET') return propertyStats(c({ id: statsMatch[1] }));

    // Static assets
    return env.ASSETS.fetch(request);
  },
};
