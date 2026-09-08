import { NextRequest, NextResponse } from "next/server";
import { db, isSupabaseAvailable } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { slugifyOrRandom } from "@/lib/slug";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "list";
    const slug = searchParams.get("slug");

    if (type === "detail" && slug) {
      const data = await db.getPouchBySlug(slug);
      if (!data.pouch) {
        return NextResponse.json({ error: "Pouch not found" }, { status: 404 });
      }
      return NextResponse.json(data);
    }

    const data = await db.getPouches();
    return NextResponse.json({
      ...data,
      isSupabaseConnected: isSupabaseAvailable(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load data";
    console.error("GET /api/pouch/manage error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { name, message, slug, password, isPasswordProtected } = body;

      if (!name || name.trim().length === 0) {
        return NextResponse.json({ error: "Pouch name is required" }, { status: 400 });
      }

      const finalSlug = slugifyOrRandom(slug, name);

      let passwordHash: string | null = null;
      if (isPasswordProtected && password && password.trim().length > 0) {
        passwordHash = await hashPassword(password.trim());
      }

      const result = await db.createPouch({
        name: name.trim(),
        slug: finalSlug,
        message: message ? message.trim() : null,
        password_hash: passwordHash,
      });

      return NextResponse.json({
        success: true,
        pouch: result.pouch,
        isLocal: result.isLocal,
      });
    }

    if (action === "update_password") {
      const { id, isPasswordProtected, password } = body;

      if (!id) {
        return NextResponse.json({ error: "Pouch ID is required" }, { status: 400 });
      }

      let passwordHash: string | null = null;
      if (isPasswordProtected && password && password.trim().length > 0) {
        passwordHash = await hashPassword(password.trim());
      }

      const success = await db.updatePassword(id, passwordHash);
      return NextResponse.json({ success, has_password: !!passwordHash });
    }

    if (action === "delete") {
      const { id } = body;

      if (!id) {
        return NextResponse.json({ error: "Pouch ID is required" }, { status: 400 });
      }

      const success = await db.deletePouch(id);
      return NextResponse.json({ success });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/pouch/manage error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
