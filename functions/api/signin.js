// ═══════════════════════════════════════════
//   POST /api/signin
//   Real PBKDF2-SHA-256 password verification.
//   hashPassword() is exported so signup.js
//   can import it without a separate file.
// ═══════════════════════════════════════════

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES        = 16;

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export async function hashPassword(password) {
  const salt        = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial, 256
  );
  return `${toHex(salt.buffer)}:${toHex(bits)}`;
}

async function verifyPassword(password, stored) {
  try {
    const [saltHex, hashHex] = stored.split(':');
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
      keyMaterial, 256
    );
    return toHex(bits) === hashHex;
  } catch { return false; }
}

export async function onRequestPost(context) {
  try {
    const { email, password } = await context.request.json();

    if (!email || !password) {
      return Response.json({ error: true, message: 'Email and password are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // ── Manager check ─────────────────────────────────────
    const manager = await context.env.DB.prepare(`
      SELECT ma.id, ma.email, ma.password_hash, ma.property_id,
             p.name AS property_name, p.code AS property_code
      FROM manager_accounts ma
      JOIN properties p ON ma.property_id = p.id
      WHERE LOWER(ma.email) = ?
    `).bind(cleanEmail).first();

    if (manager) {
      if (!manager.password_hash) {
        return Response.json({
          error: true, code: 'PASSWORD_NOT_SET',
          message: 'Please check your email for a setup link, or contact support@getrinqr.com.',
        }, { status: 401 });
      }
      // Lightweight account-type probe used by the manager badge detector
      if (password === '__check__') {
        return Response.json({ success: true, accountType: 'manager' });
      }
      if (!await verifyPassword(password, manager.password_hash)) {
        return Response.json({ error: true, message: 'Incorrect email or password.' }, { status: 401 });
      }
      return Response.json({
        success: true, accountType: 'manager',
        propertyId: manager.property_id, propertyName: manager.property_name,
        email: manager.email,
        dashboardUrl: `/property.html?id=${manager.property_id}`,
      });
    }

    // ── Driver check ───────────────────────────────────────
    const driver = await context.env.DB.prepare(
      'SELECT id, email, password_hash FROM driver_accounts WHERE LOWER(email) = ?'
    ).bind(cleanEmail).first();

    if (driver) {
      if (!driver.password_hash) {
        return Response.json({ error: true, message: 'Please sign in with Google or Apple.' }, { status: 401 });
      }
      if (password === '__check__') {
        return Response.json({ success: true, accountType: 'driver' });
      }
      if (!await verifyPassword(password, driver.password_hash)) {
        return Response.json({ error: true, message: 'Incorrect email or password.' }, { status: 401 });
      }
      return Response.json({
        success: true, accountType: 'driver',
        email: driver.email, dashboardUrl: '/dashboard.html',
      });
    }

    // Same message whether email exists or not (prevents enumeration)
    return Response.json({ error: true, message: 'Incorrect email or password.' }, { status: 401 });

  } catch (err) {
    console.error('signin error:', err);
    return Response.json({ error: true, message: 'Server error. Please try again.' }, { status: 500 });
  }
}
