import { NextRequest, NextResponse } from "next/server";

// Routes connected custom domains to their published site.
//
// SAFE BY DEFAULT: if MAIN_APP_HOST is not set, this is a no-op — the app
// serves every host normally (your main domain just works). Configure
// MAIN_APP_HOST (comma-separated allowed) only when onboarding client custom
// domains; then any host that ISN'T your main domain / *.vercel.app / localhost
// is treated as a client's published-site domain and served from /site-view.
export function proxy(req: NextRequest) {
  const mains = (process.env.MAIN_APP_HOST || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  // Not configured → never hijack any host.
  if (mains.length === 0) return NextResponse.next();

  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const url = req.nextUrl;

  const isPlatformHost =
    !host ||
    host === "localhost" ||
    host.endsWith(".vercel.app") ||
    /^[0-9.]+$/.test(host) ||
    mains.includes(host) ||
    mains.some((m) => host === `www.${m}`) ||
    (!!process.env.APP_DOMAIN &&
      (host === process.env.APP_DOMAIN || host === `www.${process.env.APP_DOMAIN}`));

  if (isPlatformHost) return NextResponse.next();

  // Treat as a client's custom domain → serve its mapped published site (root only).
  if (url.pathname === "/" || url.pathname === "") {
    const rewrite = url.clone();
    rewrite.pathname = "/site-view";
    rewrite.searchParams.set("host", host);
    return NextResponse.rewrite(rewrite);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|site-view|favicon.ico).*)"],
};
