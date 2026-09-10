import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAvailable } from "@/lib/db";
import { localStore } from "@/lib/local-store";

export const dynamic = "force-dynamic";

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

    // Determine the admin email recipient:
    // 1. First check explicit ADMIN_EMAIL environment variable
    // 2. If not set, automatically query Supabase Auth for the admin user's login email
    let recipientEmail = process.env.ADMIN_EMAIL?.trim();

    if (!recipientEmail && isSupabaseAvailable()) {
      try {
        const adminClient = getAdminClient();
        const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 10 });
        if (!error && data?.users && data.users.length > 0) {
          const userWithEmail = data.users.find((u) => u.email) || data.users[0];
          if (userWithEmail?.email) {
            recipientEmail = userWithEmail.email;
          }
        }
      } catch (authErr) {
        console.warn("Could not auto-fetch admin email from Supabase Auth:", authErr);
      }
    }

    const sender = sender_name || "A client";
    const filesList = Array.isArray(file_names) ? file_names : [];
    const filesCountText = filesList.length === 1 ? "1 file" : `${filesList.length} files`;
    const subject = `${sender} uploaded ${filesCountText} to '${pouchName}'`;

    // Determine production / Vercel link
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    let appUrl = "http://localhost:3000";
    if (configuredAppUrl && !configuredAppUrl.includes("localhost")) {
      appUrl = configuredAppUrl.replace(/\/$/, "");
    } else if (vercelUrl) {
      appUrl = `https://${vercelUrl.replace(/\/$/, "")}`;
    }
    const pouchUrl = `${appUrl}/dashboard/pouch/${pouchSlug}`;

    const resendApiKey = process.env.RESEND_API_KEY;
    // Default to Resend's free onboarding domain if SENDER_EMAIL is not configured
    const senderEmail = process.env.SENDER_EMAIL || "Inbox <onboarding@resend.dev>";

    // Format sender message
    const messageHtml = sender_message?.trim()
      ? `<div style="background-color: #faf8f5; border-left: 3px solid #e08a3c; border-radius: 6px; padding: 14px 16px; margin: 0 0 20px 0;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #e08a3c; margin-bottom: 6px;">
            Message from ${sender.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
          </div>
          <div style="font-size: 14px; color: #14161f; font-style: italic; line-height: 1.5;">
            &ldquo;${sender_message.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}&rdquo;
          </div>
        </div>`
      : "";

    // Format uploaded files list
    const filesHtml = filesList.length > 0
      ? `<div style="background-color: #faf8f5; border: 1px solid #e5e0d8; border-radius: 8px; padding: 14px 16px; margin: 0 0 24px 0;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 8px;">
            Uploaded Files (${filesList.length})
          </div>
          <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #14161f; line-height: 1.6;">
            ${filesList.map((f: string) => `<li style="margin-bottom: 2px;">📄 ${String(f).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</li>`).join("")}
          </ul>
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
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border: 1px solid #e5e0d8; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04);" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="padding: 36px 32px;">
              <!-- Brand Header -->
              <div style="font-size: 22px; font-weight: 700; color: #14161f; margin-bottom: 6px; letter-spacing: -0.3px;">
                📦 Inbox
              </div>
              <!-- Subheading -->
              <div style="font-size: 15px; font-weight: 600; color: #6b7280; margin-bottom: 24px;">
                New files received!
              </div>

              <!-- Body text -->
              <p style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0 0 20px 0;">
                <strong>${sender.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</strong> uploaded ${filesCountText} to your pouch &ldquo;<strong>${pouchName.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</strong>&rdquo;.
              </p>

              <!-- Optional Sender Message -->
              ${messageHtml}

              <!-- Uploaded Files List -->
              ${filesHtml}

              <!-- Action Button -->
              <div style="margin-bottom: 28px;">
                <a href="${pouchUrl}" style="display: inline-block; background-color: #e08a3c; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 10px; letter-spacing: 0.2px;">
                  View &amp; Download Files &rarr;
                </a>
              </div>

              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid #f0ece5; margin: 24px 0 20px 0;" />

              <!-- Footer -->
              <div style="font-size: 12px; color: #9ca3af; text-align: left; line-height: 1.5;">
                Sent to <strong>${(recipientEmail || "Admin").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</strong><br/>
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

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured. Email notification skipped.");
      return NextResponse.json({
        notified: false,
        reason: "RESEND_API_KEY environment variable is not configured. Add it in Vercel to receive emails.",
        recipient: recipientEmail || "Not detected",
        preview: { subject, to: recipientEmail, pouchUrl, fileCount: filesList.length, sender_message },
      });
    }

    if (!recipientEmail) {
      console.warn("No admin recipient email found.");
      return NextResponse.json({
        notified: false,
        reason: "No admin email found. Set ADMIN_EMAIL in Vercel or create an admin user in Supabase Auth.",
      }, { status: 400 });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderEmail,
        to: [recipientEmail],
        subject: subject,
        html: html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      return NextResponse.json({
        notified: false,
        error: data.message || "Failed to dispatch email via Resend",
        recipient: recipientEmail,
      }, { status: res.status });
    }

    return NextResponse.json({ success: true, recipient: recipientEmail, resend: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Failed to dispatch notification email:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
