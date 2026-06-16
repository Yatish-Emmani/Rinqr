// ═══════════════════════════════════════════
//   GET /api/scans?email=user@example.com&limit=50
//   Returns scan history for all tags owned
//   by this driver, newest first.
// ═══════════════════════════════════════════

export async function onRequestGet(context) {
  try {
    const url   = new URL(context.request.url);
    const email = url.searchParams.get('email')?.trim().toLowerCase();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const tagId = url.searchParams.get('tagId') || null; // optional filter

    if (!email) {
      return Response.json({ error: true, message: 'Email required.' }, { status: 400 });
    }

    // Get driver's phone
    const driver = await context.env.DB.prepare(
      'SELECT phone FROM driver_accounts WHERE LOWER(email) = ?'
    ).bind(email).first();

    if (!driver?.phone) {
      return Response.json({ success: true, scans: [], total: 0 });
    }

    const digits = driver.phone.replace(/\D/g, '').slice(-10);

    // Build query — optionally filter by tag
    let query, bindings;
    if (tagId) {
      query = `
        SELECT se.id, se.tag_id, se.reason, se.message,
               se.location_city, se.resolved, se.created_at
        FROM scan_events se
        JOIN tags t ON se.tag_id = t.tag_id
        WHERE SUBSTR(
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(t.owner_phone,' ',''),'-',''),'(',''),')',''),'+',''),
          -10
        ) = ?
        AND se.tag_id = ?
        ORDER BY se.created_at DESC
        LIMIT ?
      `;
      bindings = [digits, tagId.toUpperCase(), limit];
    } else {
      query = `
        SELECT se.id, se.tag_id, se.reason, se.message,
               se.location_city, se.resolved, se.created_at
        FROM scan_events se
        JOIN tags t ON se.tag_id = t.tag_id
        WHERE SUBSTR(
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(t.owner_phone,' ',''),'-',''),'(',''),')',''),'+',''),
          -10
        ) = ?
        ORDER BY se.created_at DESC
        LIMIT ?
      `;
      bindings = [digits, limit];
    }

    const result = await context.env.DB.prepare(query).bind(...bindings).all();
    const scans  = result.results || [];

    // Count total scans this month
    const monthResult = await context.env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM scan_events se
      JOIN tags t ON se.tag_id = t.tag_id
      WHERE SUBSTR(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(t.owner_phone,' ',''),'-',''),'(',''),')',''),'+',''),
        -10
      ) = ?
      AND se.created_at >= datetime('now', 'start of month')
    `).bind(digits).first();

    return Response.json({
      success:      true,
      scans,
      total:        scans.length,
      totalThisMonth: monthResult?.count || 0,
    });

  } catch (err) {
    console.error('scans error:', err);
    return Response.json({ error: true, message: 'Server error.' }, { status: 500 });
  }
}
