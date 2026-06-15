// ═══════════════════════════════════════════
//   POST /api/send-message
//   Called by index.html (scanner page) when
//   someone scans a tag and sends a message.
//   Logs the scan to D1, then fires an SMS
//   alert to the tag owner via Twilio.
//
//   Secrets needed (set via wrangler secret put):
//     TWILIO_ACCOUNT_SID   — from console.twilio.com
//     TWILIO_AUTH_TOKEN    — from console.twilio.com
//     TWILIO_FROM_NUMBER   — your purchased Twilio number, e.g. +18885550174
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

    // Basic scanner phone validation
    const scannerDigits = scannerPhone.replace(/\D/g, '');
    if (scannerDigits.length < 10) {
      return Response.json(
        { error: true, message: 'Please enter a valid 10-digit phone number.' },
        { status: 400 }
      );
    }

    const cleanTagId = tagId.toUpperCase().trim();

    // ── 1. Look up the tag ────────────────────────────────────
    const tag = await context.env.DB.prepare(
      'SELECT * FROM tags WHERE tag_id = ?'
    ).bind(cleanTagId).first();

    if (!tag) {
      return Response.json({ error: 'TAG_NOT_FOUND' }, { status: 404 });
    }
    if (!tag.active) {
      return Response.json({ error: 'TAG_INACTIVE' }, { status: 403 });
    }

    // ── 2. Log the scan event ─────────────────────────────────
    // In production: hash scannerPhone before storing
    // Simple SHA-256 hash using Web Crypto (available in Workers)
    const encoder      = new TextEncoder();
    const hashBuffer   = await crypto.subtle.digest('SHA-256', encoder.encode(scannerDigits));
    const hashArray    = Array.from(new Uint8Array(hashBuffer));
    const hashedPhone  = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    await context.env.DB.prepare(`
      INSERT INTO scan_events (id, tag_id, property_id, reason, message, scanner_phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      cleanTagId,
      tag.property_id || null,
      reason,
      message        || null,
      hashedPhone
    ).run();

    // ── 3. Send SMS to owner via Twilio ───────────────────────
    // Skip if Twilio secrets are not configured (dev mode)
    if (context.env.TWILIO_ACCOUNT_SID &&
        context.env.TWILIO_AUTH_TOKEN   &&
        context.env.TWILIO_FROM_NUMBER) {

      // In production, tag.owner_phone should be decrypted here
      // before passing to Twilio. For now we use it as-is.
      const ownerPhone = tag.owner_phone;

      // Format scanner phone for display (never expose full number to owner)
      const maskedScanner = `(***) ***-${scannerDigits.slice(-4)}`;

      // Build SMS body
      const vehicleLabel = tag.vehicle_desc
        ? `your ${tag.vehicle_desc}`
        : 'your vehicle';

      const smsLines = [
        `🔔 Rinqr alert for ${vehicleLabel} (${cleanTagId})`,
        `Reason: ${reason}`,
      ];
      if (message) {
        smsLines.push(`Message: "${message}"`);
      }
      smsLines.push(
        `Scanner: ${maskedScanner}`,
        `Reply anonymously at: https://getrinqr.com/dashboard.html`,
        `To pause alerts reply STOP`
      );
      const smsBody = smsLines.join('\n');

      // Twilio REST API call
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${context.env.TWILIO_ACCOUNT_SID}/Messages.json`;
      const twilioParams = new URLSearchParams({
        To:   ownerPhone,
        From: context.env.TWILIO_FROM_NUMBER,
        Body: smsBody,
      });

      const twilioRes = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(
            `${context.env.TWILIO_ACCOUNT_SID}:${context.env.TWILIO_AUTH_TOKEN}`
          ),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: twilioParams.toString(),
      });

      if (!twilioRes.ok) {
        // Log the error but don't fail the request —
        // the scan is already logged and the owner can still check their dashboard
        const twilioErr = await twilioRes.text();
        console.error('Twilio SMS error:', twilioErr);
      } else {
        const twilioData = await twilioRes.json();
        console.log('SMS sent, SID:', twilioData.sid);
      }
    } else {
      // Dev mode: log what would have been sent
      console.log('[DEV] Twilio not configured. Would have sent SMS to owner of', cleanTagId);
      console.log('[DEV] Reason:', reason, '| Message:', message || '(none)');
    }

    return Response.json({ success: true });

  } catch (err) {
    console.error('send-message error:', err);
    return Response.json(
      { error: true, message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
