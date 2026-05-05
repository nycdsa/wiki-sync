import fs from "node:fs/promises";
import path from "node:path";

export function ensureAbsolutePath(filePath: string): string {
  if (!path.isAbsolute(filePath)) {
    throw new Error(`Output path must be absolute: received "${filePath}"`);
  }
  return filePath;
}

export async function writeJsonAtomic(destinationPath: string, payload: unknown): Promise<void> {
  const outPath = ensureAbsolutePath(destinationPath);
  const parent = path.dirname(outPath);
  await fs.mkdir(parent, { recursive: true });

  const tmpPath = path.join(parent, `.${path.basename(outPath)}.${Date.now()}.tmp`);
  await fs.writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, outPath);
}
