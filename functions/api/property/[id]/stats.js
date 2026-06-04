// ═══════════════════════════════════════════
//   GET /api/property/[id]/stats
//   Called by property.html to load real
//   scan stats and incidents for a property.
//
//   URL param: [id] = property UUID
//   Example: /api/property/abc-123.../stats
// ═══════════════════════════════════════════

export async function onRequestGet(context) {
  try {
    const propertyId = context.params.id;

    if (!propertyId) {
      return Response.json({ error: 'Missing property ID' }, { status: 400 });
    }

    // Total scans this month
    const totalScans = await context.env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM scan_events
      WHERE property_id = ?
      AND created_at >= datetime('now', 'start of month')
    `).bind(propertyId).first();

    // All-time scans
    const allTimeScans = await context.env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM scan_events
      WHERE property_id = ?
    `).bind(propertyId).first();

    // Active tags
    const activeTags = await context.env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM tags
      WHERE property_id = ? AND active = 1
    `).bind(propertyId).first();

    // Total tags (including inactive)
    const totalTags = await context.env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM tags
      WHERE property_id = ?
    `).bind(propertyId).first();

    // Scans this week
    const weekScans = await context.env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM scan_events
      WHERE property_id = ?
      AND created_at >= datetime('now', '-7 days')
    `).bind(propertyId).first();

    // Last 10 incidents (most recent first)
    const incidents = await context.env.DB.prepare(`
      SELECT
        se.id,
        se.tag_id,
        se.reason,
        se.message,
        se.resolved,
        se.created_at,
        t.vehicle_desc,
        t.unit_number,
        t.owner_name
      FROM scan_events se
      JOIN tags t ON se.tag_id = t.tag_id
      WHERE se.property_id = ?
      ORDER BY se.created_at DESC
      LIMIT 10
    `).bind(propertyId).all();

    // Scans per day — last 7 days (for bar chart)
    const chartData = await context.env.DB.prepare(`
      SELECT
        DATE(created_at) as day,
        COUNT(*) as count
      FROM scan_events
      WHERE property_id = ?
      AND created_at >= datetime('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `).bind(propertyId).all();

    // Property info
    const property = await context.env.DB.prepare(`
      SELECT id, name, address, plan, units, created_at
      FROM properties
      WHERE id = ?
    `).bind(propertyId).first();

    if (!property) {
      return Response.json({ error: 'Property not found' }, { status: 404 });
    }

    return Response.json({
      property,
      stats: {
        totalScansThisMonth: totalScans.count,
        totalScansAllTime:   allTimeScans.count,
        activeTags:          activeTags.count,
        totalTags:           totalTags.count,
        scansThisWeek:       weekScans.count,
      },
      incidents: incidents.results,
      chartData:  chartData.results,
    });

  } catch (err) {
    console.error('property stats error:', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
