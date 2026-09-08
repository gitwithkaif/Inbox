import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  try {
    const { slug, password } = await req.json();

    if (!slug || !password) {
      return NextResponse.json({ error: "Slug and password are required" }, { status: 400 });
    }

    const { pouch } = await db.getPouchBySlug(slug);

    if (!pouch) {
      return NextResponse.json({ error: "Pouch not found" }, { status: 404 });
    }

    if (!pouch.password_hash) {
      // Not password protected
      return NextResponse.json({ success: true });
    }

    const isMatch = await verifyPassword(password, pouch.password_hash);
    if (!isMatch) {
      return NextResponse.json({ success: false, error: "Incorrect password. Please try again." }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Verification failed";
    console.error("Error verifying pouch password:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
