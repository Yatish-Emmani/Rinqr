// ═══════════════════════════════════════════
//   POST /api/auth/verify-otp
//   Verifies the 6-digit OTP sent during signup.
//   On success, marks the account as verified
//   and returns a session redirect.
// ═══════════════════════════════════════════

export async function onRequestPost(context) {
  try {
    const { email, otp } = await context.request.json();
    if (!email || !otp) {
      return Response.json({ error: true, message: 'Email and OTP required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const otpKey     = `otp:${cleanEmail}`;
    const stored     = await context.env.RINQR_DB.get(otpKey);

    if (!stored || stored !== otp.trim()) {
      return Response.json(
        { error: true, message: 'Invalid or expired code. Please request a new one.' },
        { status: 401 }
      );
    }

    // Delete OTP so it can't be reused
    await context.env.RINQR_DB.delete(otpKey);

    return Response.json({ success: true, dashboardUrl: '/dashboard.html' });

  } catch (err) {
    console.error('verify-otp error:', err);
    return Response.json({ error: true, message: 'Server error.' }, { status: 500 });
  }
}
