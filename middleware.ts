import { NextRequest, NextResponse } from "next/server";

// Maps published sites to real subdomains: <id>.APP_DOMAIN  ->  /s/<id>
//
// Inactive until you set APP_DOMAIN (e.g. "ojibuilder.app") in Vercel and add a
// wildcard domain "*.ojibuilder.app" to the project. Until then this is a no-op,
// so the current *.vercel.app URL keeps working normally.
export function middleware(req: NextRequest) {
  const appDomain = process.env.APP_DOMAIN;
  if (!appDomain) return NextResponse.next();

  const host = (req.headers.get("host") || "").split(":")[0];
  if (host === appDomain || host === `www.${appDomain}`) return NextResponse.next();
  if (!host.endsWith(`.${appDomain}`)) return NextResponse.next();

  const sub = host.slice(0, -1 * (appDomain.length + 1));
  if (!sub || sub === "www") return NextResponse.next();

  const url = req.nextUrl.clone();
  // Only rewrite the site root; let assets/API pass through.
  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = `/s/${sub}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico).*)"],
};
