import { NextRequest, NextResponse } from "next/server";
import { addDomain, getDomainStatus, vercelConfigured } from "@/lib/vercel";
import { saveDomain, readPublished } from "@/lib/store";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const maxDuration = 30;

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;

// POST { domain, siteId } -> connect domain to the project + map it to the site.
export async function POST(req: NextRequest) {
  const rl = rateLimit(`dom:${clientIp(req)}`, 15, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "طلبات كثيرة جدًا" }, { status: 429 });

  if (!vercelConfigured) {
    return NextResponse.json(
      { error: "ربط النطاقات غير مفعّل: اضبط VERCEL_API_TOKEN و VERCEL_PROJECT_ID" },
      { status: 503 }
    );
  }

  const { domain, siteId } = await req.json();
  const d = String(domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!DOMAIN_RE.test(d)) return NextResponse.json({ error: "نطاق غير صالح" }, { status: 400 });
  if (!siteId || !(await readPublished(siteId))) {
    return NextResponse.json({ error: "انشر الموقع أولًا قبل ربط النطاق" }, { status: 400 });
  }

  const add = await addDomain(d);
  if (!add.ok) return NextResponse.json({ error: add.error }, { status: 502 });

  await saveDomain(d, siteId);
  const status = await getDomainStatus(d);
  return NextResponse.json(status);
}

// GET ?domain= -> current verification status
export async function GET(req: NextRequest) {
  if (!vercelConfigured) return NextResponse.json({ error: "غير مفعّل" }, { status: 503 });
  const d = (req.nextUrl.searchParams.get("domain") || "").trim().toLowerCase();
  if (!DOMAIN_RE.test(d)) return NextResponse.json({ error: "نطاق غير صالح" }, { status: 400 });
  return NextResponse.json(await getDomainStatus(d));
}
