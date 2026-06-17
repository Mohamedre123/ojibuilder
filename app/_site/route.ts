import { NextRequest, NextResponse } from "next/server";
import { readDomainSite, readPublished } from "@/lib/store";

// Serves a published site for a connected custom domain.
// The middleware rewrites custom-domain requests here with ?host=<domain>.
export async function GET(req: NextRequest) {
  const host = (req.nextUrl.searchParams.get("host") || req.headers.get("host") || "")
    .split(":")[0]
    .toLowerCase();
  const siteId = host ? await readDomainSite(host) : null;
  const html = siteId ? await readPublished(siteId) : null;
  if (!html) {
    return new NextResponse("لا يوجد موقع مرتبط بهذا النطاق بعد.", { status: 404 });
  }
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
