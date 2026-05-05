import fs from "node:fs/promises";

const START_MARKER = "/* wiki-sync-temporary-start */";
const END_MARKER = "/* wiki-sync-temporary-end */";

export async function enableApiTemporarily(localPhpPath: string, apiUser: string): Promise<() => Promise<void>> {
  const original = await fs.readFile(localPhpPath, "utf8");
  const block = [
    "",
    START_MARKER,
    "$conf['remote'] = 1;",
    `$conf['remoteuser'] = '${apiUser.replaceAll("'", "\\'")}';`,
    END_MARKER,
    "",
  ].join("\n");

  const existingClean = stripTemporaryBlock(original);
  await fs.writeFile(localPhpPath, `${existingClean}${block}`, "utf8");

  return async () => {
    const current = await fs.readFile(localPhpPath, "utf8");
    const stripped = stripTemporaryBlock(current);
    await fs.writeFile(localPhpPath, stripped, "utf8");
  };
}

function stripTemporaryBlock(input: string): string {
  const start = input.indexOf(START_MARKER);
  if (start === -1) return input;
  const end = input.indexOf(END_MARKER, start);
  if (end === -1) return input;
  const afterEnd = end + END_MARKER.length;
  return `${input.slice(0, start).trimEnd()}\n${input.slice(afterEnd).trimStart()}`;
}
