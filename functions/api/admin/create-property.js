// ═══════════════════════════════════════════
//   POST /api/admin/create-property
//   YOU call this (not public users) to
//   onboard a new B2B property after a pilot
//   is confirmed.
//
//   Secrets needed:
//     ADMIN_KEY  — any secret string you set
//
//   Example curl call:
//   curl -X POST https://rinqr.workers.dev/api/admin/create-property \
//     -H "Content-Type: application/json" \
//     -H "x-admin-key: YOUR_ADMIN_KEY" \
//     -d '{"name":"Oak Ridge Apts","address":"123 Oak St, Edison NJ","managerEmail":"manager@oakridge.com","units":120}'
// ═══════════════════════════════════════════

export async function onRequestPost(context) {
  // Auth check — only you can call this
  const adminKey = context.request.headers.get('x-admin-key');
  if (!adminKey || adminKey !== context.env.ADMIN_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, address, managerEmail, units } = await context.request.json();

    if (!name || !managerEmail) {
      return Response.json(
        { error: 'name and managerEmail are required' },
        { status: 400 }
      );
    }

    // Generate property code: first 6 alphanum chars of name + "26"
    const code = name
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6) + '26';

    // Check code isn't already taken
    const existing = await context.env.RINQR_DB.get(`property:${code}`);
    if (existing) {
      return Response.json(
        { error: `Code ${code} already exists. Try a slightly different property name.` },
        { status: 409 }
      );
    }

    const property = {
      id:           crypto.randomUUID(),
      code,
      name,
      address:      address || '',
      managerEmail,
      units:        units || 0,
      plan:         'standard',
      tagCount:     0,
      active:       true,
      createdAt:    new Date().toISOString(),
    };

    // Save to KV by code (for resident activation lookup)
    await context.env.RINQR_DB.put(`property:${code}`, JSON.stringify(property));

    // Save to KV by ID (for dashboard lookups)
    await context.env.RINQR_DB.put(`property_id:${property.id}`, JSON.stringify(property));

    // Also save to D1 for SQL queries
    await context.env.DB.prepare(`
      INSERT INTO properties (id, code, name, address, manager_email, units)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      property.id,
      property.code,
      property.name,
      property.address,
      property.managerEmail,
      property.units
    ).run();

    // Create manager account so they can log in
    await context.env.DB.prepare(`
      INSERT INTO manager_accounts (id, email, property_id)
      VALUES (?, ?, ?)
    `).bind(crypto.randomUUID(), managerEmail, property.id).run();

    return Response.json({
      success:  true,
      property: {
        id:           property.id,
        code:         property.code,
        name:         property.name,
        managerEmail: property.managerEmail,
      },
      // Give these to the property manager:
      instructions: {
        propertyCode:   code,
        dashboardUrl:   `https://getrinqr.com/property.html?id=${property.id}`,
        activationNote: `Tell residents to enter code "${code}" when activating their tag at getrinqr.com/activate.html`,
      },
    });

  } catch (err) {
    console.error('create-property error:', err);
    if (err.message?.includes('UNIQUE constraint')) {
      return Response.json({ error: 'This property already exists.' }, { status: 409 });
    }
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
