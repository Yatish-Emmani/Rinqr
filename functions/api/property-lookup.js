// ═══════════════════════════════════════════
//   GET /api/property-lookup?code=OAKRID26
//   Called by activate.html when a resident
//   types their property code.
//   Returns the property name if found.
// ═══════════════════════════════════════════

export async function onRequestGet(context) {
  try {
    const url  = new URL(context.request.url);
    const code = url.searchParams.get('code')?.toUpperCase().trim();

    if (!code || code.length < 4) {
      return Response.json({ found: false }, { status: 400 });
    }

    // Look up in KV store
    const data = await context.env.RINQR_DB.get(`property:${code}`);

    if (!data) {
      return Response.json({ found: false }, { status: 404 });
    }

    const property = JSON.parse(data);

    // Only return safe public info — never expose manager email
    return Response.json({
      found: true,
      name:  property.name,
      code:  property.code,
      id:    property.id,
    });

  } catch (err) {
    console.error('property-lookup error:', err);
    return Response.json({ found: false }, { status: 500 });
  }
}
