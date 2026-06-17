import { NextRequest, NextResponse } from "next/server";

// Routes connected custom domains to their published site (Next 16 "proxy"
// convention, formerly middleware). Any host that is NOT our own app host
// (vercel.app / localhost / IP / the configured main domain) is treated as a
// client's custom domain and its root is served from /_site.
export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const url = req.nextUrl;

  const isPlatformHost =
    !host ||
    host === "localhost" ||
    host.endsWith(".vercel.app") ||
    /^[0-9.]+$/.test(host) ||
    (process.env.MAIN_APP_HOST && host === process.env.MAIN_APP_HOST) ||
    (process.env.APP_DOMAIN && (host === process.env.APP_DOMAIN || host === `www.${process.env.APP_DOMAIN}`));

  if (isPlatformHost) return NextResponse.next();

  if (url.pathname === "/" || url.pathname === "") {
    const rewrite = url.clone();
    rewrite.pathname = "/_site";
    rewrite.searchParams.set("host", host);
    return NextResponse.rewrite(rewrite);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|_site|favicon.ico).*)"],
};
