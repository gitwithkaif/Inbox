import { NextResponse } from "next/server";
import os from "os";

export const dynamic = "force-dynamic";

export async function GET() {
  const isVercel = Boolean(process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_URL);
  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  let publicUrl: string | null = null;
  if (configuredAppUrl && !configuredAppUrl.includes("localhost")) {
    publicUrl = configuredAppUrl.replace(/\/$/, "");
  } else if (vercelUrl) {
    publicUrl = `https://${vercelUrl.replace(/\/$/, "")}`;
  }

  // Detect local IP only if not in Vercel serverless environment
  let lanIp: string | null = null;
  const availableIps: { name: string; address: string }[] = [];

  if (!isVercel) {
    try {
      const ifaces = os.networkInterfaces();
      for (const [name, nets] of Object.entries(ifaces)) {
        if (!nets) continue;
        for (const net of nets) {
          if (net.family === "IPv4" && !net.internal) {
            availableIps.push({ name, address: net.address });
            if (
              !net.address.startsWith("169.254.") &&
              !name.toLowerCase().includes("vmware") &&
              !name.toLowerCase().includes("virtual") &&
              !name.toLowerCase().includes("loopback")
            ) {
              if (
                !lanIp ||
                name.toLowerCase().includes("wi-fi") ||
                name.toLowerCase().includes("wifi") ||
                name.toLowerCase().includes("ethernet")
              ) {
                lanIp = net.address;
              }
            }
          }
        }
      }
      if (!lanIp && availableIps.length > 0) {
        lanIp = availableIps[0].address;
      }
    } catch {
      // ignore
    }
  }

  const port = process.env.PORT || "3000";

  return NextResponse.json({
    isVercel,
    publicUrl,
    lanIp,
    port,
    lanUrl: lanIp ? `http://${lanIp}:${port}` : null,
    configuredAppUrl: publicUrl,
    availableIps,
  });
}
