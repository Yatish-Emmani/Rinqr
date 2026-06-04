// ═══════════════════════════════════════════
//   POST /api/send-message
//   Called by index.html (scanner page)
//   when someone scans a tag and sends
//   a message to the vehicle owner.
//   Logs the scan to D1.
//   (Twilio SMS integration added in Step 8)
// ═══════════════════════════════════════════

export async function onRequestPost(context) {
  try {
    const { tagId, reason, message, scannerPhone } = await context.request.json();

    if (!tagId || !reason || !scannerPhone) {
      return Response.json(
        { error: true, message: 'Missing required fields.' },
        { status: 400 }
      );
    }

    const cleanTagId = tagId.toUpperCase().trim();

    // Look up the tag in D1
    const tag = await context.env.DB.prepare(
      'SELECT * FROM tags WHERE tag_id = ?'
    ).bind(cleanTagId).first();

    if (!tag) {
      return Response.json({ error: 'TAG_NOT_FOUND' }, { status: 404 });
    }

    if (!tag.active) {
      return Response.json({ error: 'TAG_INACTIVE' }, { status: 403 });
    }

    // Save scan event to D1
    // ⚠️  In production: hash scannerPhone before storing
    await context.env.DB.prepare(`
      INSERT INTO scan_events (id, tag_id, property_id, reason, message, scanner_phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      cleanTagId,
      tag.property_id || null,
      reason,
      message        || null,
      scannerPhone.trim()
    ).run();

    // ── TODO (Step 8): Send SMS to tag owner via Twilio ──
    // The owner's phone is tag.owner_phone (decrypt it first in production)
    // Use Twilio's REST API to send an SMS alert to the owner

    return Response.json({ success: true });

  } catch (err) {
    console.error('send-message error:', err);
    return Response.json(
      { error: true, message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
