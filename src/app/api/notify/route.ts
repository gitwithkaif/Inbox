import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { localStore } from "@/lib/local-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pouch_id, sender_name, sender_message, file_names } = body;

    if (!pouch_id) {
      return NextResponse.json({ error: "pouch_id is required" }, { status: 400 });
    }

    let pouchName = "Inbox Pouch";
    let pouchSlug = "";

    try {
      const adminClient = getAdminClient();
      const { data: pouch } = await adminClient
        .from("pouches")
        .select("name, slug")
        .eq("id", pouch_id)
        .single();

      if (pouch) {
        pouchName = pouch.name;
        pouchSlug = pouch.slug;
      }
    } catch {
      // Fallback to local store
      const localPouch = localStore.getPouchById(pouch_id);
      if (localPouch) {
        pouchName = localPouch.name;
        pouchSlug = localPouch.slug;
      }
    }

    const sender = sender_name || "Someone";
    const subject = `${sender} uploaded files to '${pouchName}'`;

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const pouchUrl = `${appUrl}/dashboard/pouch/${pouchSlug}`;
    const resendApiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL;
    const senderEmail = process.env.SENDER_EMAIL || "Inbox <noreply@yourdomain.com>";

    const messageHtml = sender_message
      ? `<div style="background-color: #faf8f5; border-left: 3px solid #e08a3c; border-radius: 4px; padding: 12px 16px; margin: 0 0 24px 0; font-size: 14px; color: #4b5563; font-style: italic;">
          &ldquo;${sender_message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}&rdquo;
        </div>`
      : "";

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #f4f1ec; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #14161f;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e5e0d8; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="padding: 36px 32px;">
              <!-- Header -->
              <div style="font-size: 24px; font-weight: 700; color: #14161f; margin-bottom: 8px; letter-spacing: -0.3px;">
                📦 Inbox
              </div>
              <!-- Subheading -->
              <div style="font-size: 16px; font-weight: 600; color: #6b7280; margin-bottom: 24px;">
                New files uploaded!
              </div>

              <!-- Body text -->
              <p style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0 0 20px 0;">
                <strong>${sender}</strong> uploaded files to your pouch &ldquo;<strong>${pouchName}</strong>&rdquo;.
              </p>

              <!-- Optional Sender Message -->
              ${messageHtml}

              <!-- Orange Button -->
              <div style="margin-bottom: 28px;">
                <a href="${pouchUrl}" style="display: inline-block; background-color: #e08a3c; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px; letter-spacing: 0.2px;">
                  View Your Pouch &rarr;
                </a>
              </div>

              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid #f0ece5; margin: 24px 0 20px 0;" />

              <!-- Footer -->
              <div style="font-size: 12px; color: #9ca3af; text-align: left;">
                Inbox &mdash; Dead-simple file requests
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    if (!resendApiKey || !adminEmail) {
      return NextResponse.json({
        notified: false,
        reason: "RESEND_API_KEY or ADMIN_EMAIL not set",
        preview: { subject, to: adminEmail, pouchUrl, fileCount: file_names?.length || 0, sender_message },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderEmail,
        to: [adminEmail],
        subject: subject,
        html: html,
      }),
    });

    const data = await res.json();
    return NextResponse.json({ success: true, resend: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Failed to dispatch notification email:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
