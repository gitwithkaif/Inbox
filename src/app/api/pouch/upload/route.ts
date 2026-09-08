import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db, isSupabaseAvailable } from "@/lib/db";
import { UPLOAD_DIR } from "@/lib/local-store";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const pouchId = formData.get("pouch_id") as string | null;
    const senderName = formData.get("sender_name") as string | null;
    const senderMessage = (formData.get("sender_message") as string | null)?.trim() || null;

    if (!file || !pouchId || !senderName) {
      return NextResponse.json({ error: "Missing required upload parameters" }, { status: 400 });
    }

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const relativePath = `${pouchId}/${Date.now()}_${cleanFileName}`;

    if (!isSupabaseAvailable()) {
      // Local storage fallback
      const targetDir = path.join(UPLOAD_DIR, pouchId);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const fullPath = path.join(UPLOAD_DIR, relativePath);
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(fullPath, buffer);

      const record = await db.addFile({
        pouch_id: pouchId,
        file_name: file.name,
        file_size: file.size,
        storage_path: relativePath,
        sender_name: senderName.trim(),
        sender_message: senderMessage,
      });

      return NextResponse.json({ success: true, file: record, isLocal: true });
    }

    // If Supabase is available, we can insert into db
    const record = await db.addFile({
      pouch_id: pouchId,
      file_name: file.name,
      file_size: file.size,
      storage_path: relativePath,
      sender_name: senderName.trim(),
      sender_message: senderMessage,
    });

    return NextResponse.json({ success: true, file: record, isLocal: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload processing failed";
    console.error("Error in /api/pouch/upload:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
