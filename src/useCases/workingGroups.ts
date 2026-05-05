import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkingGroupCard, WorkingGroupsResponse } from "../types.js";
import { jsonRpcCall } from "../wikiClient.js";

type StructRow = Record<string, string>;

const repoRoot = path.join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

export async function buildWorkingGroupsPayload(args: {
  host: string;
  token?: string;
  wikiDataRoot: string;
}): Promise<WorkingGroupsResponse> {
  const baselineByPage = await loadBaselineByPageId();
  const groupsFromPages = await readWorkingGroupsFromPages(args.wikiDataRoot);
  const byPageId = new Map(groupsFromPages.map((group) => [group.pageId, group] as const));

  const structRows = await tryStructAggregation(args.host, args.token);
  for (const row of structRows) {
    const pageId = row["%pageid%"] || row.pageid;
    if (!pageId) continue;
    const existing = byPageId.get(pageId);
    if (!existing) continue;

    existing.status = firstNonEmpty(nonPlaceholder(row.status), existing.status);
    existing.email = firstNonEmpty(nonPlaceholder(row.email), existing.email);
    existing.website = firstNonEmpty(nonPlaceholder(row.website), existing.website);
    existing.linktree = firstNonEmpty(nonPlaceholder(row.linktree), existing.linktree);
    existing.instagram = firstNonEmpty(nonPlaceholder(row.instagram), existing.instagram);
    const form = nonPlaceholder(row.action_network_form);
    if (!existing.primaryCta && form) {
      existing.primaryCta = { url: normalizeDokuWikiLink(form), label: "Join Us" };
    }
    existing.secondaryCtas = buildSecondaryCtas(existing.website, existing.linktree, existing.instagram);
  }

  for (const card of byPageId.values()) {
    sanitizeWorkingGroupCard(card);
    const baseline = baselineByPage.get(card.pageId);
    if (baseline) {
      mergeBaseline(card, baseline);
    }
    card.secondaryCtas = buildSecondaryCtas(card.website, card.linktree, card.instagram);
    if (card.secondaryCtas.length === 0 && baselineByPage.get(card.pageId)?.secondaryCtas?.length) {
      card.secondaryCtas = baselineByPage.get(card.pageId)!.secondaryCtas;
    }
  }

  const groups = [...byPageId.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    version: 1,
    fetchedAt: new Date().toISOString(),
    groups,
  };
}

async function loadBaselineByPageId(): Promise<Map<string, WorkingGroupCard>> {
  const baselinePath = path.join(repoRoot, "config", "working-groups-baseline.json");
  try {
    const raw = await fs.readFile(baselinePath, "utf8");
    const data = JSON.parse(raw) as WorkingGroupsResponse;
    if (!Array.isArray(data.groups)) return new Map();
    return new Map(data.groups.map((g) => [g.pageId, g] as const));
  } catch {
    return new Map();
  }
}

function mergeBaseline(card: WorkingGroupCard, base: WorkingGroupCard): void {
  card.name = base.name;
  card.imageUrl = base.imageUrl;

  if (isBadScalar(card.email) || !looksLikeEmail(card.email)) {
    card.email = base.email;
  }
  if (isBadScalar(card.website)) card.website = base.website;
  if (isBadScalar(card.linktree)) card.linktree = base.linktree;
  if (isBadScalar(card.instagram)) card.instagram = base.instagram;
  if (isBadScalar(card.status)) card.status = base.status;

  const wikiDesc = stripStructPlaceholders(card.description).trim();
  card.description = wikiDesc || base.description;

  const wikiPrimary = card.primaryCta?.url ?? "";
  if (isBadScalar(wikiPrimary) || isPlaceholder(wikiPrimary)) {
    card.primaryCta = base.primaryCta;
  } else {
    const label = card.primaryCta?.label?.trim() || base.primaryCta?.label || "Join Us";
    card.primaryCta = {
      url: normalizeDokuWikiLink(wikiPrimary),
      label,
    };
  }
}

function sanitizeWorkingGroupCard(card: WorkingGroupCard): void {
  card.name = stripStructPlaceholders(card.name).trim() || card.pageId;
  card.description = stripStructPlaceholders(card.description);
  card.email = normalizeDokuWikiLink(stripStructPlaceholders(card.email));
  card.website = normalizeDokuWikiLink(stripStructPlaceholders(card.website));
  card.linktree = normalizeDokuWikiLink(stripStructPlaceholders(card.linktree));
  card.instagram = stripStructPlaceholders(card.instagram);
  if (card.website === "N/A") card.website = "";
  if (card.linktree === "N/A") card.linktree = "";
  if (card.email === "N/A") card.email = "";

  if (card.primaryCta?.url) {
    const u = normalizeDokuWikiLink(stripStructPlaceholders(card.primaryCta.url));
    if (isBadScalar(u) || isPlaceholder(u)) {
      card.primaryCta = null;
    } else {
      card.primaryCta = { ...card.primaryCta, url: u };
    }
  }

  card.secondaryCtas = card.secondaryCtas
    .map((c) => ({
      label: c.label,
      url: normalizeDokuWikiLink(stripStructPlaceholders(c.url)),
    }))
    .filter((c) => c.url && !isPlaceholder(c.url));
}

export function isPlaceholder(value: string | undefined | null): boolean {
  if (!value) return false;
  return value.includes("{{$working_groups.") || value.includes("{{$working_groups}");
}

export function stripStructPlaceholders(value: string): string {
  return value
    .replace(/\{\{\$working_groups\.[^}]+\}\}/g, "")
    .replace(/\*\*\s*\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nonPlaceholder(value: string | undefined): string {
  const v = value?.trim() ?? "";
  if (!v || isPlaceholder(v)) return "";
  return v;
}

function isBadScalar(value: string | undefined | null): boolean {
  if (value === undefined || value === null) return true;
  const v = value.trim();
  return v === "" || v === "N/A" || isPlaceholder(v);
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** DokuWiki `[[https://x|y]]` or `[[https://x]]` in contact bullets. */
export function normalizeDokuWikiLink(raw: string): string {
  let s = raw.trim();
  if (!s || s === "N/A") return "";
  const m = s.match(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*$/);
  if (m) return m[1].trim();
  return s;
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

function extractTitle(text: string, pageId: string): string {
  const wiki = text.match(/^=+\s*(.*?)\s*=+/m);
  if (wiki?.[1]?.trim()) return wiki[1].trim();
  const md = text.match(/^#\s+(.+)$/m);
  if (md?.[1]?.trim()) return md[1].trim();
  return pageId;
}

function parseWorkingGroupPage(pageId: string, text: string): WorkingGroupCard {
  const name = extractTitle(text, pageId);
  const description = extractDescription(text);
  let email = extractBulletField(text, "Primary contact email");
  let intake = extractBulletField(text, "Intake form");
  let website = extractBulletField(text, "Website");
  let linktree = extractBulletField(text, "Linktree");
  const instagramRaw = extractBulletField(text, "Socials");
  email = normalizeDokuWikiLink(email);
  intake = normalizeDokuWikiLink(intake);
  website = normalizeDokuWikiLink(website);
  linktree = normalizeDokuWikiLink(linktree);
  const instagram = normalizeInstagram(instagramRaw);
  const imageUrl = null;

  let primaryCta: WorkingGroupCard["primaryCta"];
  if (intake && !isPlaceholder(intake)) {
    primaryCta = { url: intake, label: "Join Us" };
  } else if (website && !isPlaceholder(website) && website !== "N/A") {
    primaryCta = { url: website, label: "Our Website" };
  } else {
    primaryCta = null;
  }

  return {
    pageId,
    name,
    description,
    status: "active",
    email,
    website: website === "N/A" ? "" : website,
    linktree: linktree === "N/A" ? "" : linktree,
    instagram,
    imageUrl,
    primaryCta,
    secondaryCtas: buildSecondaryCtas(website === "N/A" ? "" : website, linktree === "N/A" ? "" : linktree, instagram),
  };
}

function extractDescription(text: string): string {
  const region = text.split("<button collapse-id=\"wg_infobox\">")[0] ?? text;
  const lines = region.split("\n").map((line) => line.trim());
  const paragraphs: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("=") || line.startsWith("<") || line.startsWith("{{") || line.startsWith("//")) continue;
    if (line.startsWith("#")) continue;
    if (line.includes("{{$working_groups.")) continue;
    paragraphs.push(line);
  }
  return stripStructPlaceholders((paragraphs[0] ?? "").replaceAll("—", "-"));
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
