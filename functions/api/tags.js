// ═══════════════════════════════════════════
//   GET /api/tags?email=user@example.com
//   Returns all tags for a driver, matched
//   by stripping phone formatting on both sides.
// ═══════════════════════════════════════════

export async function onRequestGet(context) {
  try {
    const url   = new URL(context.request.url);
    const email = url.searchParams.get('email')?.trim().toLowerCase();

    if (!email) {
      return Response.json({ error: true, message: 'Email required.' }, { status: 400 });
    }

    // Get the driver's phone
    const driver = await context.env.DB.prepare(
      'SELECT id, phone FROM driver_accounts WHERE LOWER(email) = ?'
    ).bind(email).first();

    if (!driver?.phone) {
      return Response.json({ success: true, tags: [], totalScans: 0, activeTags: 0 });
    }

    // Strip all non-digits from the stored phone, keep last 10 digits
    const digits = driver.phone.replace(/\D/g, '').slice(-10);

    // Match tags where the last 10 digits of owner_phone match
    // Uses SQLite REPLACE to strip formatting characters from owner_phone
    const result = await context.env.DB.prepare(`
      SELECT
        t.id,
        t.tag_id,
        t.owner_name,
        t.vehicle_type,
        t.vehicle_desc,
        t.unit_number,
        t.active,
        t.created_at,
        COUNT(se.id)      AS scan_count,
        MAX(se.created_at) AS last_scan_at
      FROM tags t
      LEFT JOIN scan_events se ON se.tag_id = t.tag_id
      WHERE SUBSTR(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          t.owner_phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''
        ), -10
      ) = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `).bind(digits).all();

    const tags = result.results || [];

    return Response.json({
      success:     true,
      tags,
      totalScans:  tags.reduce((sum, t) => sum + (t.scan_count || 0), 0),
      activeTags:  tags.filter(t => t.active).length,
    });

  } catch (err) {
    console.error('tags error:', err);
    return Response.json({ error: true, message: 'Server error.' }, { status: 500 });
  }
}
