// ═══════════════════════════════════════════
//   POST /api/auth/reset-password
//   Generates a reset token, stores in KV
//   with 1hr TTL, sends link via Resend.
//
//   POST /api/auth/reset-password/confirm
//   Verifies token, updates password hash.
//
//   Secrets needed: RESEND_API_KEY
// ═══════════════════════════════════════════

import { hashPassword } from '../signin.js';

// ── Request reset ─────────────────────────────────────────
export async function onRequestPost(context) {
  try {
    const url  = new URL(context.request.url);

    // Confirm route: /api/auth/reset-password/confirm
    if (url.pathname.endsWith('/confirm')) {
      return handleConfirm(context);
    }

    const { email } = await context.request.json();
    if (!email) {
      return Response.json({ error: true, message: 'Email required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check account exists (don't reveal if it doesn't)
    const driver = await context.env.DB.prepare(
      'SELECT id FROM driver_accounts WHERE LOWER(email) = ?'
    ).bind(cleanEmail).first();

    if (driver) {
      // Generate a secure token
      const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
      const token      = Array.from(tokenBytes).map(b => b.toString(16).padStart(2,'0')).join('');
      const key        = `reset:${token}`;

      // Store in KV with 1hr TTL
      await context.env.RINQR_DB.put(key, cleanEmail, { expirationTtl: 3600 });

      const resetUrl = `https://rinqr.com/reset-password.html?token=${token}`;

      // Send email via Resend
      if (context.env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: {
            'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            from:    'Rinqr <noreply@getrinqr.com>',
            to:      cleanEmail,
            subject: 'Reset your Rinqr password',
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0d0d0d;color:#e8edf2;border-radius:12px">
                <img src="https://rinqr.com/Rinqr_logo.png" alt="Rinqr" style="height:40px;margin-bottom:24px">
                <h2 style="color:#00b4aa;margin-bottom:8px">Reset your password</h2>
                <p style="color:rgba(232,237,242,.6);margin-bottom:24px">Click the button below to reset your password. This link expires in 1 hour.</p>
                <a href="${resetUrl}" style="display:inline-block;background:#00b4aa;color:#0d0d0d;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px">Reset password →</a>
                <p style="color:rgba(232,237,242,.3);font-size:12px;margin-top:24px">If you didn't request this, ignore this email. Your password won't change.</p>
                <p style="color:rgba(232,237,242,.3);font-size:11px;margin-top:8px;word-break:break-all">Link: ${resetUrl}</p>
              </div>
            `,
          }),
        });
      } else {
        console.log(`[DEV] Reset link for ${cleanEmail}: ${resetUrl}`);
      }
    }

    // Always return success (prevents email enumeration)
    return Response.json({
      success: true,
      message: 'If an account exists with that email, a reset link has been sent.',
    });

  } catch (err) {
    console.error('reset-password error:', err);
    return Response.json({ error: true, message: 'Server error.' }, { status: 500 });
  }
}

// ── Confirm reset ─────────────────────────────────────────
async function handleConfirm(context) {
  try {
    const { token, newPassword } = await context.request.json();

    if (!token || !newPassword) {
      return Response.json({ error: true, message: 'Token and new password required.' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return Response.json({ error: true, message: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const key   = `reset:${token}`;
    const email = await context.env.RINQR_DB.get(key);

    if (!email) {
      return Response.json(
        { error: true, message: 'Reset link is invalid or has expired.' },
        { status: 401 }
      );
    }

    // Hash the new password
    const passwordHash = await hashPassword(newPassword);

    // Update in DB
    await context.env.DB.prepare(
      'UPDATE driver_accounts SET password_hash = ? WHERE LOWER(email) = ?'
    ).bind(passwordHash, email).run();

    // Delete the token so it can't be reused
    await context.env.RINQR_DB.delete(key);

    return Response.json({ success: true, message: 'Password updated. You can now sign in.' });

  } catch (err) {
    console.error('reset-confirm error:', err);
    return Response.json({ error: true, message: 'Server error.' }, { status: 500 });
  }
}
