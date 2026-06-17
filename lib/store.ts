// Persistent store for published sites and saved projects.
//
// On Vercel: uses Vercel Blob (set BLOB_READ_WRITE_TOKEN — auto-added when you
// create a Blob store in the Vercel dashboard). Works on the free Hobby plan.
// Locally (no token): falls back to the filesystem so `next dev` keeps working.
import { promises as fs } from "fs";
import path from "path";

const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const DIR = path.join(process.cwd(), ".published");

function safeId(id: string): string {
  return id.replace(/[^a-z0-9-]/gi, "").slice(0, 64);
}

async function blobPut(pathname: string, content: string, contentType: string): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(pathname, content, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });
}

async function blobRead(pathname: string): Promise<string | null> {
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: pathname, limit: 1 });
  const hit = blobs.find((b) => b.pathname === pathname) || blobs[0];
  if (!hit) return null;
  const res = await fetch(hit.url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.text();
}

async function fileWrite(rel: string, content: string): Promise<void> {
  const full = path.join(DIR, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
}
async function fileRead(rel: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(DIR, rel), "utf8");
  } catch {
    return null;
  }
}

// ---- published sites ----
export async function savePublished(id: string, html: string): Promise<void> {
  const key = `sites/${safeId(id)}.html`;
  if (hasBlob) await blobPut(key, html, "text/html; charset=utf-8");
  else await fileWrite(key, html);
}
export async function readPublished(id: string): Promise<string | null> {
  const key = `sites/${safeId(id)}.html`;
  return hasBlob ? blobRead(key) : fileRead(key);
}

// ---- saved projects ----
export interface ProjectData {
  html: string;
  title: string;
  updatedAt: number;
}
export async function saveProject(id: string, data: ProjectData): Promise<void> {
  const key = `projects/${safeId(id)}.json`;
  const json = JSON.stringify(data);
  if (hasBlob) await blobPut(key, json, "application/json");
  else await fileWrite(key, json);
}
export async function loadProject(id: string): Promise<ProjectData | null> {
  const key = `projects/${safeId(id)}.json`;
  const raw = hasBlob ? await blobRead(key) : await fileRead(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProjectData;
  } catch {
    return null;
  }
}
