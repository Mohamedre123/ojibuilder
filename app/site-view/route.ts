import { NextRequest, NextResponse } from "next/server";
import { readDomainSite, readPublished } from "@/lib/store";

// Serves a published site for a connected custom domain.
// The proxy rewrites custom-domain requests here with ?host=<domain>.
export async function GET(req: NextRequest) {
  const host = (req.nextUrl.searchParams.get("host") || req.headers.get("host") || "")
    .split(":")[0]
    .toLowerCase();

  // Auto subdomain: <id>.<APP_DOMAIN> serves published site <id> directly,
  // no per-site mapping needed (Manus-style share links).
  const appDomain = (process.env.APP_DOMAIN || "").toLowerCase();
  let siteId: string | null = null;
  if (appDomain && host.endsWith("." + appDomain) && host !== "www." + appDomain) {
    siteId = host.slice(0, -(appDomain.length + 1));
  }
  // Otherwise treat host as a connected custom domain.
  if (!siteId && host) siteId = await readDomainSite(host);
  const html = siteId ? await readPublished(siteId) : null;
  if (!html) {
    return new NextResponse("لا يوجد موقع مرتبط بهذا النطاق بعد.", { status: 404 });
  }
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
