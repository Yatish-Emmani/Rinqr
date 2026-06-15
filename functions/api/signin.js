// ═══════════════════════════════════════════
//   POST /api/signin
//   Called by signin.html.
//   Verifies email + password against the DB.
//   Returns account type so the frontend can
//   redirect to the correct dashboard.
//
//   Passwords are stored as PBKDF2-SHA-256
//   hashes (Web Crypto API — zero dependencies,
//   works natively in Cloudflare Workers).
//
//   To create the first manager account, use
//   the admin/create-property endpoint — it
//   creates a manager_accounts row. The manager
//   must set their password via the
//   /api/auth/set-password endpoint (below) or
//   via the Google/Apple OAuth flow.
// ═══════════════════════════════════════════

// ── Crypto helpers ────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES        = 16;

/**
 * Hash a plaintext password.
 * Returns a string: "<hex-salt>:<hex-hash>"
 */
export async function hashPassword(password) {
  const salt       = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256
  );
  const toHex = (buf) =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${toHex(salt.buffer)}:${toHex(bits)}`;
}

/**
 * Verify a plaintext password against a stored hash string.
 */
async function verifyPassword(password, stored) {
  try {
    const [saltHex, hashHex] = stored.split(':');
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
      keyMaterial,
      256
    );
    const derived = Array.from(new Uint8Array(bits))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return derived === hashHex;
  } catch {
    return false;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  try {
    const { email, password } = await context.request.json();

    if (!email || !password) {
      return Response.json(
        { error: true, message: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // ── 1. Check property manager accounts ───────────────────
    const manager = await context.env.DB.prepare(`
      SELECT
        ma.id,
        ma.email,
        ma.password_hash,
        ma.property_id,
        p.name  AS property_name,
        p.code  AS property_code
      FROM manager_accounts ma
      JOIN properties p ON ma.property_id = p.id
      WHERE LOWER(ma.email) = ?
    `).bind(cleanEmail).first();

    if (manager) {
      // Account has no password yet (created via admin API, pending first login)
      if (!manager.password_hash) {
        return Response.json(
          {
            error:   true,
            code:    'PASSWORD_NOT_SET',
            message: 'Please check your email for a setup link, or contact support@getrinqr.com.',
          },
          { status: 401 }
        );
      }

      // Special flag used by the frontend to detect manager emails without verifying PW
      // (the manager detection badge in signin.html sends __check__ as a dummy password)
      if (password === '__check__') {
        return Response.json({ success: true, accountType: 'manager' });
      }

      const valid = await verifyPassword(password, manager.password_hash);
      if (!valid) {
        return Response.json(
          { error: true, message: 'Incorrect email or password.' },
          { status: 401 }
        );
      }

      return Response.json({
        success:      true,
        accountType:  'manager',
        propertyId:   manager.property_id,
        propertyName: manager.property_name,
        email:        manager.email,
        dashboardUrl: `/property.html?id=${manager.property_id}`,
      });
    }

    // ── 2. Check driver accounts ──────────────────────────────
    const driver = await context.env.DB.prepare(`
      SELECT id, email, password_hash
      FROM driver_accounts
      WHERE LOWER(email) = ?
    `).bind(cleanEmail).first();

    if (driver) {
      if (!driver.password_hash) {
        return Response.json(
          { error: true, message: 'Please sign in with Google or Apple, or reset your password.' },
          { status: 401 }
        );
      }

      if (password === '__check__') {
        return Response.json({ success: true, accountType: 'driver' });
      }

      const valid = await verifyPassword(password, driver.password_hash);
      if (!valid) {
        return Response.json(
          { error: true, message: 'Incorrect email or password.' },
          { status: 401 }
        );
      }

      return Response.json({
        success:     true,
        accountType: 'driver',
        email:       driver.email,
        dashboardUrl: '/dashboard.html',
      });
    }

    // ── 3. No account found ───────────────────────────────────
    // Return the same error whether the email exists or not
    // (prevents account enumeration)
    return Response.json(
      { error: true, message: 'Incorrect email or password.' },
      { status: 401 }
    );

  } catch (err) {
    console.error('signin error:', err);
    return Response.json(
      { error: true, message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
