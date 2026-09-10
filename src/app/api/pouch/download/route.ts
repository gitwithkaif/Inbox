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

    const safeName = fileName.replace(/["\r\n]/g, "");
    const encodedName = encodeURIComponent(safeName);

    // 1. If Supabase is available, download directly from Supabase Storage (no expiring signed URL / JWT timestamp check)
    if (isSupabaseAvailable() && storagePath) {
      try {
        const client = getAdminClient();
        const { data: blob, error } = await client.storage
          .from("pouch-files")
          .download(storagePath);

        if (!error && blob) {
          const arrayBuffer = await blob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const headers = new Headers();
          headers.set(
            "Content-Disposition",
            `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`
          );
          headers.set("Content-Type", blob.type || "application/octet-stream");
          headers.set("Content-Length", String(buffer.length));
          headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");

          return new NextResponse(buffer, {
            status: 200,
            headers,
          });
        }

        if (error) {
          console.warn("Supabase storage download error, attempting fallback:", error.message);
        }
      } catch (sbErr) {
        console.warn("Supabase download exception, attempting fallback:", sbErr);
      }
    }

    // 2. Local file fallback
    let targetPath = storagePath;
    if (!targetPath && fileId) {
      const fileRecord = localStore.getFileById(fileId);
      if (fileRecord) {
        targetPath = fileRecord.storage_path;
      }
    }

    if (targetPath) {
      const fullPath = path.join(UPLOAD_DIR, targetPath);
      if (fs.existsSync(fullPath)) {
        const fileBuffer = fs.readFileSync(fullPath);
        const headers = new Headers();
        headers.set(
          "Content-Disposition",
          `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`
        );
        headers.set("Content-Type", "application/octet-stream");
        headers.set("Content-Length", String(fileBuffer.length));
        headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");

        return new NextResponse(fileBuffer, {
          status: 200,
          headers,
        });
      }
    }

    return NextResponse.json({ error: "File not found in cloud or local storage" }, { status: 404 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Download failed";
    console.error("Error in /api/pouch/download:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
