import { NextResponse } from "next/server";
import os from "os";

export const dynamic = "force-dynamic";

export async function GET() {
  const ifaces = os.networkInterfaces();
  let lanIp: string | null = null;
  const availableIps: { name: string; address: string }[] = [];

  for (const [name, nets] of Object.entries(ifaces)) {
    if (!nets) continue;
    for (const net of nets) {
      // Look for non-internal IPv4
      if (net.family === "IPv4" && !net.internal) {
        availableIps.push({ name, address: net.address });
        // Prioritize Wi-Fi or Ethernet addresses that are not 169.254 (link-local) or VM interfaces
        if (
          !net.address.startsWith("169.254.") &&
          !name.toLowerCase().includes("vmware") &&
          !name.toLowerCase().includes("virtual") &&
          !name.toLowerCase().includes("loopback")
        ) {
          if (!lanIp || name.toLowerCase().includes("wi-fi") || name.toLowerCase().includes("wifi") || name.toLowerCase().includes("ethernet")) {
            lanIp = net.address;
          }
        }
      }
    }
  }

  // Fallback to first available non-internal IP if no preferred found
  if (!lanIp && availableIps.length > 0) {
    lanIp = availableIps[0].address;
  }

  const port = process.env.PORT || "3000";
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  return NextResponse.json({
    lanIp,
    port,
    lanUrl: lanIp ? `http://${lanIp}:${port}` : null,
    configuredAppUrl: configuredAppUrl && !configuredAppUrl.includes("localhost") ? configuredAppUrl : null,
    availableIps,
  });
}
