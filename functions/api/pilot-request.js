// ═══════════════════════════════════════════
//   POST /api/pilot-request
//   Called by property.html contact form.
//   Sends you an email via Resend when a
//   property manager requests a free pilot.
//
//   Secrets needed (set via wrangler secret put):
//     RESEND_API_KEY   — from resend.com
// ═══════════════════════════════════════════

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { first, last, email, property, city, units, pain } = body;

    // Basic validation
    if (!first || !email || !property) {
      return Response.json(
        { error: true, message: 'Please fill in your name, email, and property name.' },
        { status: 400 }
      );
    }

    // Send email to Yatish via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // ⚠️  Change the `from` address to a verified domain in your Resend account.
        //     While testing you can use: from: 'onboarding@resend.dev'
        from: 'Rinqr Leads <leads@rinqr.com>',
        to:   '32minebrook96b@gmail.com',
        reply_to: email,
        subject: `🏢 New pilot request — ${property}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <h2 style="color:#00b4aa;margin-bottom:4px">New Rinqr Pilot Request</h2>
            <p style="color:#666;margin-top:0">Someone just requested a free pilot. Reply directly to their email below.</p>
            <table style="width:100%;border-collapse:collapse;margin-top:16px">
              <tr style="border-bottom:1px solid #eee">
                <td style="padding:10px 0;color:#999;font-size:12px;width:120px">NAME</td>
                <td style="padding:10px 0;font-weight:500">${first} ${last || ''}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee">
                <td style="padding:10px 0;color:#999;font-size:12px">EMAIL</td>
                <td style="padding:10px 0"><a href="mailto:${email}" style="color:#00b4aa">${email}</a></td>
              </tr>
              <tr style="border-bottom:1px solid #eee">
                <td style="padding:10px 0;color:#999;font-size:12px">PROPERTY</td>
                <td style="padding:10px 0;font-weight:500">${property}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee">
                <td style="padding:10px 0;color:#999;font-size:12px">CITY</td>
                <td style="padding:10px 0">${city || '—'}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee">
                <td style="padding:10px 0;color:#999;font-size:12px">UNITS</td>
                <td style="padding:10px 0">${units || '—'}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#999;font-size:12px">PAIN POINT</td>
                <td style="padding:10px 0">${pain || '—'}</td>
              </tr>
            </table>
            <div style="margin-top:24px;padding:14px;background:#f0faf8;border-left:3px solid #00b4aa;border-radius:0 6px 6px 0">
              <strong>Next step:</strong> Reply to ${email} and schedule a 15-min onboarding call.
            </div>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend error:', errText);
      return Response.json(
        { error: true, message: 'Email failed to send. Please try emailing yatish@getrinqr.com directly.' },
        { status: 500 }
      );
    }

    return Response.json({ success: true });

  } catch (err) {
    console.error('pilot-request error:', err);
    return Response.json(
      { error: true, message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
