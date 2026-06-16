// ═══════════════════════════════════════════
//   POST /api/signup
//   Creates a driver account with hashed password.
//   OTP step is optional — frontend can skip it.
// ═══════════════════════════════════════════

import { hashPassword } from './signin.js';

export async function onRequestPost(context) {
  try {
    const { firstName, lastName, email, phone, password } = await context.request.json();

    if (!firstName || !email || !phone || !password) {
      return Response.json({ error: true, message: 'First name, email, phone, and password are required.' }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ error: true, message: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return Response.json({ error: true, message: 'Please enter a valid 10-digit phone number.' }, { status: 400 });
    }

    // Check for duplicate
    const existing = await context.env.DB.prepare(
      'SELECT id FROM driver_accounts WHERE LOWER(email) = ?'
    ).bind(cleanEmail).first();
    if (existing) {
      return Response.json({ error: true, message: 'An account with that email already exists. Try signing in.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const accountId    = crypto.randomUUID();

    await context.env.DB.prepare(`
      INSERT INTO driver_accounts (id, email, password_hash, phone)
      VALUES (?, ?, ?, ?)
    `).bind(accountId, cleanEmail, passwordHash, `+1${cleanPhone}`).run();

    // Optional OTP — only fires if Twilio is configured
    if (context.env.TWILIO_ACCOUNT_SID) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      await context.env.RINQR_DB.put(`otp:${cleanEmail}`, otp, { expirationTtl: 600 });
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${context.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${context.env.TWILIO_ACCOUNT_SID}:${context.env.TWILIO_AUTH_TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: `+1${cleanPhone}`, From: context.env.TWILIO_FROM_NUMBER,
          Body: `Your Rinqr verification code is ${otp}. It expires in 10 minutes.`,
        }).toString(),
      });
    }

    return Response.json({ success: true, accountId });

  } catch (err) {
    console.error('signup error:', err);
    if (err.message?.includes('UNIQUE constraint')) {
      return Response.json({ error: true, message: 'An account with that email already exists.' }, { status: 409 });
    }
    return Response.json({ error: true, message: 'Server error. Please try again.' }, { status: 500 });
  }
}
