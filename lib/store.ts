// Simple published-site store. Uses the local filesystem so it works in
// `next dev`. NOTE: on serverless hosts (Vercel) the filesystem is ephemeral —
// swap this for Vercel Blob / KV / a database when moving to production.
import { promises as fs } from "fs";
import path from "path";

const DIR = path.join(process.cwd(), ".published");

function safeId(id: string): string {
  return id.replace(/[^a-z0-9-]/gi, "");
}

export async function savePublished(id: string, html: string): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, `${safeId(id)}.html`), html, "utf8");
}

export async function readPublished(id: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(DIR, `${safeId(id)}.html`), "utf8");
  } catch {
    return null;
  }
}
