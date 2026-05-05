import fs from "node:fs/promises";
import path from "node:path";
import type { ExtractionResult } from "../types.js";

function pageIdToRelativePath(pageId: string): string {
  return `${pageId.replaceAll(":", "/")}.txt`;
}

function parseKeyValueLines(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key || !value) continue;
    if (!/^[A-Za-z0-9 _-]+$/.test(key)) continue;
    out[key] = value;
  }
  return out;
}

export async function extractViaRawPage(args: { wikiDataRoot: string; pageId: string }): Promise<ExtractionResult> {
  const rel = pageIdToRelativePath(args.pageId);
  const filePath = path.join(args.wikiDataRoot, "pages", rel);
  const raw = await fs.readFile(filePath, "utf8");
  return {
    source: "raw",
    pageId: args.pageId,
    data: {
      raw,
      keyValues: parseKeyValueLines(raw),
      filePath,
    },
  };
}
