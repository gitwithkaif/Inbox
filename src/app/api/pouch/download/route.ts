import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { localStore, UPLOAD_DIR } from "@/lib/local-store";
import { getAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAvailable } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");
    const storagePath = searchParams.get("path");
    const fileName = searchParams.get("name") || "download";

    if (!fileId && !storagePath) {
      return NextResponse.json({ error: "fileId or path required" }, { status: 400 });
    }

    if (isSupabaseAvailable() && storagePath) {
      const client = getAdminClient();
      const { data, error } = await client.storage
        .from("pouch-files")
        .createSignedUrl(storagePath, 300, { download: fileName });

      if (!error && data?.signedUrl) {
        return NextResponse.redirect(data.signedUrl);
      }
    }

    // Local file fallback
    let targetPath = storagePath;
    if (!targetPath && fileId) {
      const fileRecord = localStore.getFileById(fileId);
      if (fileRecord) {
        targetPath = fileRecord.storage_path;
      }
    }

    if (!targetPath) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fullPath = path.join(UPLOAD_DIR, targetPath);
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(fullPath);
    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    headers.set("Content-Type", "application/octet-stream");

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Download failed";
    console.error("Error in /api/pouch/download:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
