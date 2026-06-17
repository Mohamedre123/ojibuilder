import { NextResponse } from "next/server";
import { loadProject } from "@/lib/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProject(id);
  if (!data) return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
  return NextResponse.json(data);
}
