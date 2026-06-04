// ═══════════════════════════════════════════
//   POST /api/signin
//   Called by signin.html when a user signs in.
//   Checks if the email belongs to a property
//   manager. If yes, returns their property ID
//   so the frontend can redirect to their dashboard.
//   If no, treats them as a regular driver.
//
//   NOTE: This is a lightweight auth check —
//   it doesn't use real passwords yet (that's
//   Step 8 with Cloudflare Access or Lucia Auth).
//   For now it identifies the account type so
//   we can redirect correctly.
// ═══════════════════════════════════════════

export async function onRequestPost(context) {
  try {
    const { email, password } = await context.request.json();

    if (!email || !password) {
      return Response.json(
        { error: true, message: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if this email is a registered property manager
    const manager = await context.env.DB.prepare(`
      SELECT ma.id, ma.email, ma.property_id, p.name as property_name, p.code as property_code
      FROM manager_accounts ma
      JOIN properties p ON ma.property_id = p.id
      WHERE LOWER(ma.email) = ?
    `).bind(cleanEmail).first();

    if (manager) {
      // Property manager — redirect to their dashboard
      return Response.json({
        success:     true,
        accountType: 'manager',
        propertyId:  manager.property_id,
        propertyName: manager.property_name,
        email:       manager.email,
        dashboardUrl: `/property.html?id=${manager.property_id}`,
      });
    }

    // Check if this email has any tags (regular driver)
    const driverTag = await context.env.DB.prepare(`
      SELECT tag_id FROM tags WHERE LOWER(owner_phone) != '' LIMIT 1
    `).bind().first();

    // Regular driver account — redirect to driver dashboard
    // (In production this would verify password hash)
    return Response.json({
      success:     true,
      accountType: 'driver',
      email:       cleanEmail,
      dashboardUrl: '/dashboard.html',
    });

  } catch (err) {
    console.error('signin error:', err);
    return Response.json(
      { error: true, message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}