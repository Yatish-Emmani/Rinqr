// ═══════════════════════════════════════════
//   POST /api/profile
//   Updates a driver's profile.
//   Body: { currentEmail, name, newEmail, phone }
//   currentEmail used to identify the account.
// ═══════════════════════════════════════════

export async function onRequestPost(context) {
  try {
    const { currentEmail, name, newEmail, phone } = await context.request.json();

    if (!currentEmail) {
      return Response.json({ error: true, message: 'currentEmail is required.' }, { status: 400 });
    }

    const cleanCurrent = currentEmail.trim().toLowerCase();
    const cleanNew     = newEmail?.trim().toLowerCase() || cleanCurrent;

    // Check driver exists
    const driver = await context.env.DB.prepare(
      'SELECT id FROM driver_accounts WHERE LOWER(email) = ?'
    ).bind(cleanCurrent).first();

    if (!driver) {
      return Response.json({ error: true, message: 'Account not found.' }, { status: 404 });
    }

    // If changing email, check it's not already taken
    if (cleanNew !== cleanCurrent) {
      const existing = await context.env.DB.prepare(
        'SELECT id FROM driver_accounts WHERE LOWER(email) = ?'
      ).bind(cleanNew).first();
      if (existing) {
        return Response.json(
          { error: true, message: 'That email is already in use.' },
          { status: 409 }
        );
      }
    }

    // Build update fields
    const updates = [];
    const values  = [];

    if (cleanNew !== cleanCurrent) {
      updates.push('email = ?');
      values.push(cleanNew);
    }
    if (phone) {
      const cleanPhone = '+1' + phone.replace(/\D/g, '').slice(-10);
      updates.push('phone = ?');
      values.push(cleanPhone);
    }

    if (updates.length === 0) {
      return Response.json({ success: true, message: 'Nothing to update.' });
    }

    values.push(cleanCurrent);
    await context.env.DB.prepare(
      `UPDATE driver_accounts SET ${updates.join(', ')} WHERE LOWER(email) = ?`
    ).bind(...values).run();

    return Response.json({
      success: true,
      email:   cleanNew,
      message: 'Profile updated.',
    });

  } catch (err) {
    console.error('profile error:', err);
    return Response.json({ error: true, message: 'Server error.' }, { status: 500 });
  }
}
