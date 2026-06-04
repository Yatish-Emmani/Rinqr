// ═══════════════════════════════════════════
//   POST /api/activate
//   Called by activate.html when a resident
//   activates their Rinqr tag.
//   Saves to D1 and links to property if
//   a valid property code was entered.
// ═══════════════════════════════════════════

export async function onRequestPost(context) {
  try {
    const {
      tagId,
      ownerName,
      ownerPhone,
      vehicleType,
      vehicleDesc,
      propertyCode,
      propertyId,
      propertyName,
      unitNumber,
    } = await context.request.json();

    // Validation
    if (!tagId || !ownerName || !ownerPhone) {
      return Response.json(
        { error: true, message: 'Tag ID, name, and phone number are required.' },
        { status: 400 }
      );
    }

    const cleanTagId = tagId.toUpperCase().trim();

    // If a propertyCode was provided but propertyId is empty, re-verify it
    let resolvedPropertyId = propertyId || null;
    let resolvedPropertyName = propertyName || null;

    if (propertyCode && !resolvedPropertyId) {
      const propData = await context.env.RINQR_DB.get(`property:${propertyCode.toUpperCase()}`);
      if (propData) {
        const prop = JSON.parse(propData);
        resolvedPropertyId   = prop.id;
        resolvedPropertyName = prop.name;
      }
    }

    // Insert tag into D1
    // ⚠️  In production: encrypt ownerPhone with AES-256 before storing
    await context.env.DB.prepare(`
      INSERT INTO tags (id, tag_id, owner_name, owner_phone, vehicle_type, vehicle_desc, property_id, unit_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      cleanTagId,
      ownerName.trim(),
      ownerPhone.trim(),
      vehicleType  || '',
      vehicleDesc  || '',
      resolvedPropertyId || null,
      unitNumber   || ''
    ).run();

    // If linked to a property, bump tag count in KV
    if (resolvedPropertyId) {
      const propData = await context.env.RINQR_DB.get(`property_id:${resolvedPropertyId}`);
      if (propData) {
        const prop = JSON.parse(propData);
        prop.tagCount = (prop.tagCount || 0) + 1;
        await context.env.RINQR_DB.put(`property_id:${resolvedPropertyId}`, JSON.stringify(prop));
        await context.env.RINQR_DB.put(`property:${prop.code}`, JSON.stringify(prop));
      }
    }

    return Response.json({
      success:        true,
      propertyLinked: !!resolvedPropertyId,
      propertyName:   resolvedPropertyName,
    });

  } catch (err) {
    console.error('activate error:', err);

    // Duplicate tag ID
    if (err.message?.includes('UNIQUE constraint failed')) {
      return Response.json(
        { error: true, message: 'This tag ID is already registered. Check your sticker and try again.' },
        { status: 409 }
      );
    }

    return Response.json(
      { error: true, message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
