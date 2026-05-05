import fs from "node:fs/promises";
import path from "node:path";
import type { WorkingGroupCard, WorkingGroupsResponse } from "../types.js";
import { jsonRpcCall } from "../wikiClient.js";

type StructRow = Record<string, string>;

export async function buildWorkingGroupsPayload(args: {
  host: string;
  token?: string;
  wikiDataRoot: string;
}): Promise<WorkingGroupsResponse> {
  const groupsFromPages = await readWorkingGroupsFromPages(args.wikiDataRoot);
  const byPageId = new Map(groupsFromPages.map((group) => [group.pageId, group] as const));

  const structRows = await tryStructAggregation(args.host, args.token);
  for (const row of structRows) {
    const pageId = row["%pageid%"] || row.pageid;
    if (!pageId) continue;
    const existing = byPageId.get(pageId);
    if (!existing) continue;

    existing.status = firstNonEmpty(row.status, existing.status);
    existing.email = firstNonEmpty(row.email, existing.email);
    existing.website = firstNonEmpty(row.website, existing.website);
    existing.linktree = firstNonEmpty(row.linktree, existing.linktree);
    existing.instagram = firstNonEmpty(row.instagram, existing.instagram);
    if (!existing.primaryCta && row.action_network_form) {
      existing.primaryCta = { url: row.action_network_form, label: "Join Us" };
    }
    existing.secondaryCtas = buildSecondaryCtas(existing.website, existing.linktree, existing.instagram);
  }

  const groups = [...byPageId.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    version: 1,
    fetchedAt: new Date().toISOString(),
    groups,
  };
}

async function tryStructAggregation(host: string, token?: string): Promise<StructRow[]> {
  if (!token) return [];
  const cols = [
    "%pageid%",
    "name",
    "description",
    "status",
    "email",
    "website",
    "linktree",
    "instagram",
    "action_network_form",
  ];

  try {
    const rows = await jsonRpcCall<Array<Record<string, string>>>(host, "plugin.struct.getAggregationData", [["working_groups"], cols, [], ""], token);
    return rows.map(simplifyStructRow);
  } catch {
    return [];
  }
}

function simplifyStructRow(row: Record<string, string>): StructRow {
  const out: StructRow = {};
  for (const [key, value] of Object.entries(row)) {
    const short = key.includes(".") ? key.slice(key.indexOf(".") + 1) : key;
    out[short] = value;
  }
  return out;
}

async function readWorkingGroupsFromPages(wikiDataRoot: string): Promise<WorkingGroupCard[]> {
  const root = path.join(wikiDataRoot, "pages", "working_groups");
  const files = await collectStartFiles(root);
  const cards: WorkingGroupCard[] = [];

  for (const file of files) {
    const rel = path.relative(path.join(wikiDataRoot, "pages"), file);
    const pageId = rel.replaceAll(path.sep, ":").replace(/\.txt$/, "");
    if (pageId === "working_groups:start") continue;

    const text = await fs.readFile(file, "utf8");
    const card = parseWorkingGroupPage(pageId, text);
    cards.push(card);
  }

  return cards;
}

async function collectStartFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectStartFiles(full)));
      continue;
    }
    if (entry.isFile() && entry.name === "start.txt") {
      out.push(full);
    }
  }
  return out;
}

function parseWorkingGroupPage(pageId: string, text: string): WorkingGroupCard {
  const name = (text.match(/^=+\s*(.*?)\s*=+/m)?.[1] ?? pageId).trim();
  const description = extractDescription(text);
  const email = extractBulletField(text, "Primary contact email");
  const intake = extractBulletField(text, "Intake form");
  const website = extractBulletField(text, "Website");
  const linktree = extractBulletField(text, "Linktree");
  const instagramRaw = extractBulletField(text, "Socials");
  const instagram = normalizeInstagram(instagramRaw);
  const imageUrl = null;

  const primaryCta = intake ? { url: intake, label: "Join Us" } : website ? { url: website, label: "Our Website" } : null;

  return {
    pageId,
    name,
    description,
    status: "active",
    email,
    website,
    linktree,
    instagram,
    imageUrl,
    primaryCta,
    secondaryCtas: buildSecondaryCtas(website, linktree, instagram),
  };
}

function extractDescription(text: string): string {
  const region = text.split("<button collapse-id=\"wg_infobox\">")[0] ?? text;
  const lines = region.split("\n").map((line) => line.trim());
  const paragraphs: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("=") || line.startsWith("<") || line.startsWith("{{") || line.startsWith("//")) continue;
    if (line.includes("{{$working_groups.")) continue;
    paragraphs.push(line);
  }
  return (paragraphs[0] ?? "").replaceAll("—", "-");
}

/**
 * Wiki WG pages use list lines like: * **Intake form:**  https://...
 * Plain `Label: value` also appears in some drafts — handle both.
 */
/** Exported for tests — parses `* **Label:** value` contact lines. */
export function extractBulletField(text: string, label: string): string {
  const lines = text.split("\n");
  const labelLower = label.toLowerCase();

  for (const line of lines) {
    const trimmed = line.trim();
    const listStar = trimmed.match(/^\*\s+\*\*([^*]+):\*\*\s*(.*)$/);
    if (listStar) {
      if (listStar[1].trim().toLowerCase() === labelLower) {
        return normalizeFieldValue(listStar[2]);
      }
    }
  }

  for (const line of lines) {
    const t = line.trim();
    const idx = t.indexOf(":");
    if (idx === -1) continue;
    const before = t.slice(0, idx).replaceAll("*", "").trim().toLowerCase();
    if (before.endsWith(labelLower)) {
      return normalizeFieldValue(t.slice(idx + 1));
    }
  }

  return "";
}

function normalizeFieldValue(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function normalizeInstagram(value: string): string {
  if (!value) return "";
  if (value.startsWith("@")) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (/^[a-zA-Z0-9._]+$/.test(value)) return value;
  return "";
}

function buildSecondaryCtas(website: string, linktree: string, instagram: string) {
  const items: Array<{ url: string; label: string }> = [];
  if (website) items.push({ url: website, label: "Website" });
  if (linktree) items.push({ url: linktree, label: "Linktree" });
  if (instagram) {
    const url = instagram.startsWith("http://") || instagram.startsWith("https://") ? instagram : `https://instagram.com/${instagram.replace(/^@/, "")}`;
    items.push({ url, label: "Instagram" });
  }
  return items;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return "";
}
