// Supabase Edge Function: notify-upload
// Triggered on insert into public.files to send a branded email notification via Resend

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "";
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") || "Inbox <noreply@yourdomain.com>";
const APP_URL = (Deno.env.get("APP_URL") || "http://localhost:3000").replace(/\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: {
    id?: string;
    pouch_id?: string;
    file_name?: string;
    file_size?: number;
    storage_path?: string;
    sender_name?: string;
    uploaded_at?: string;
  };
  // Or direct payload
  pouch_id?: string;
  pouch_name?: string;
  pouch_slug?: string;
  sender_name?: string;
  file_name?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const payload: WebhookPayload = await req.json();
    const record = payload.record || payload;

    const senderName = record.sender_name || payload.sender_name || "Someone";
    const pouchId = record.pouch_id || payload.pouch_id;
    let pouchName = payload.pouch_name || "";
    let pouchSlug = payload.pouch_slug || "";

    // If pouch details not directly provided, query Supabase
    if ((!pouchName || !pouchSlug) && pouchId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: pouch } = await supabase
        .from("pouches")
        .select("name, slug")
        .eq("id", pouchId)
        .single();

      if (pouch) {
        pouchName = pouch.name;
        pouchSlug = pouch.slug;
      }
    }

    const finalPouchName = pouchName || "Inbox Pouch";
    const pouchUrl = `${APP_URL}/dashboard/pouch/${pouchSlug}`;

    const subject = `${senderName} uploaded files to '${finalPouchName}'`;

    // Branded HTML email template matching the exact specification:
    // White card, centered, rounded corners, light gray background, dark navy text, orange button
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
              <p style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0 0 28px 0;">
                <strong>${senderName}</strong> uploaded files to your pouch &ldquo;<strong>${finalPouchName}</strong>&rdquo;.
              </p>

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

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured. Email notification skipped.");
      return new Response(JSON.stringify({ message: "Skipped: RESEND_API_KEY not configured", preview: { subject, pouchUrl } }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const recipient = ADMIN_EMAIL;
    if (!recipient) {
      console.warn("ADMIN_EMAIL not set.");
      return new Response(JSON.stringify({ error: "ADMIN_EMAIL not configured" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: SENDER_EMAIL,
        to: [recipient],
        subject: subject,
        html: html,
      }),
    });

    const resendData = await resendRes.json();

    return new Response(JSON.stringify({ success: true, resend: resendData }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("Error in notify-upload edge function:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
