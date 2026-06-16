// ═══════════════════════════════════════════
//   POST /api/admin/generate-tags
//   Generates a batch of unique tag IDs and
//   pre-registers them in D1 so they're ready
//   to be activated by end users.
//
//   Requires x-admin-key header.
//
//   Body: { count: 10, prefix: "PP" }
//   Returns: { tags: ["PP-XXXX-XXXX", ...] }
// ═══════════════════════════════════════════

export async function onRequestPost(context) {
  // Auth
  const adminKey = context.request.headers.get('x-admin-key');
  if (!adminKey || adminKey !== context.env.ADMIN_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { count = 10, prefix = 'PP' } = await context.request.json();

    if (count < 1 || count > 200) {
      return Response.json({ error: 'Count must be between 1 and 200.' }, { status: 400 });
    }

    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 (confusing)

    function randomSegment(len) {
      let s = '';
      for (let i = 0; i < len; i++) {
        s += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      return s;
    }

    const tags = [];
    const failed = [];

    for (let i = 0; i < count; i++) {
      // Format: PP-XXXX-XXXX
      const tagId = `${prefix.toUpperCase()}-${randomSegment(4)}-${randomSegment(4)}`;

      try {
        // Insert as unactivated tag (no owner yet)
        await context.env.DB.prepare(`
          INSERT INTO tags (id, tag_id, owner_name, owner_phone, vehicle_type, active)
          VALUES (?, ?, '', '', '', 0)
        `).bind(crypto.randomUUID(), tagId).run();

        tags.push(tagId);
      } catch (err) {
        if (err.message?.includes('UNIQUE constraint')) {
          // Collision — skip and it'll be short by 1, acceptable
          failed.push(tagId);
        } else {
          throw err;
        }
      }
    }

    return Response.json({
      success: true,
      generated: tags.length,
      tags,
      failed: failed.length > 0 ? failed : undefined,
    });

  } catch (err) {
    console.error('generate-tags error:', err);
    return Response.json({ error: 'Server error.' }, { status: 500 });
  }
}
