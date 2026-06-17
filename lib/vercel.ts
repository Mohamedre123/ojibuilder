// Vercel Domains API helper — connects an end-client's custom domain to the
// project so Vercel serves it with automatic SSL.
const TOKEN = process.env.VERCEL_API_TOKEN;
const PROJECT = process.env.VERCEL_PROJECT_ID;
const TEAM = process.env.VERCEL_TEAM_ID;
const API = "https://api.vercel.com";

export const vercelConfigured = !!(TOKEN && PROJECT);

function q(extra?: Record<string, string>) {
  const p = new URLSearchParams(extra);
  if (TEAM) p.set("teamId", TEAM);
  const s = p.toString();
  return s ? `?${s}` : "";
}
function headers() {
  return { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
  note?: string;
}

export interface DomainStatus {
  domain: string;
  verified: boolean;
  records: DnsRecord[];
  verification: { type: string; domain: string; value: string }[];
}

function isApex(domain: string): boolean {
  // Heuristic: "example.com" = apex; "www.example.com" / "sub.example.com" = subdomain.
  return domain.split(".").length <= 2;
}

function baseRecords(domain: string): DnsRecord[] {
  if (isApex(domain)) {
    return [{ type: "A", name: "@", value: "76.76.21.21", note: "للنطاق الأساسي" }];
  }
  const sub = domain.split(".")[0];
  return [{ type: "CNAME", name: sub, value: "cname.vercel-dns.com", note: "للنطاق الفرعي" }];
}

// Add the domain to the project (idempotent — ignores "already added").
export async function addDomain(domain: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${API}/v10/projects/${PROJECT}/domains${q()}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name: domain }),
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  const code = data?.error?.code;
  if (code === "domain_already_in_use" || code === "domain_already_exists" || res.status === 409) {
    return { ok: true };
  }
  return { ok: false, error: data?.error?.message || `فشل إضافة النطاق (${res.status})` };
}

export async function getDomainStatus(domain: string): Promise<DomainStatus> {
  const res = await fetch(`${API}/v9/projects/${PROJECT}/domains/${domain}${q()}`, {
    headers: headers(),
  });
  const data = await res.json().catch(() => ({}));
  return {
    domain,
    verified: !!data.verified,
    records: baseRecords(domain),
    verification: Array.isArray(data.verification)
      ? data.verification.map((v: { type: string; domain: string; value: string }) => ({
          type: v.type,
          domain: v.domain,
          value: v.value,
        }))
      : [],
  };
}
