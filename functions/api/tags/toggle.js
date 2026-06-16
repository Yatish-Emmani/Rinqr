// ═══════════════════════════════════════════
//   POST /api/tags/toggle
//   Activates or pauses a tag in D1.
//   Body: { tagId, active: true|false, email }
//   Email used to verify ownership before toggle.
// ═══════════════════════════════════════════

export async function onRequestPost(context) {
  try {
    const { tagId, active, email } = await context.request.json();

    if (!tagId || active === undefined || !email) {
      return Response.json({ error: true, message: 'tagId, active, and email are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanTagId = tagId.toUpperCase().trim();

    // Look up the driver's phone from their account
    const driver = await context.env.DB.prepare(
      'SELECT phone FROM driver_accounts WHERE LOWER(email) = ?'
    ).bind(cleanEmail).first();

    if (!driver?.phone) {
      return Response.json({ error: true, message: 'Account not found.' }, { status: 404 });
    }

    // Verify this tag belongs to this user (match by phone digits)
    const digits = driver.phone.replace(/\D/g, '').slice(-10);
    const tag = await context.env.DB.prepare(`
      SELECT id FROM tags
      WHERE tag_id = ?
      AND SUBSTR(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(owner_phone,' ',''),'-',''),'(',''),')',''),'+',''),
        -10
      ) = ?
    `).bind(cleanTagId, digits).first();

    if (!tag) {
      return Response.json(
        { error: true, message: 'Tag not found or does not belong to your account.' },
        { status: 404 }
      );
    }

    // Update active status
    await context.env.DB.prepare(
      'UPDATE tags SET active = ? WHERE tag_id = ?'
    ).bind(active ? 1 : 0, cleanTagId).run();

    return Response.json({
      success: true,
      tagId:   cleanTagId,
      active:  !!active,
      message: active ? 'Tag reactivated.' : 'Tag paused.',
    });

  } catch (err) {
    console.error('toggle error:', err);
    return Response.json({ error: true, message: 'Server error.' }, { status: 500 });
  }
}
