import { NextResponse } from "next/server";
import { readPublished } from "@/lib/store";

// Serves a published site at /s/<id>.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const html = await readPublished(id);
  if (!html) {
    return new NextResponse("الموقع غير موجود أو لم يعد منشورًا", { status: 404 });
  }
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
