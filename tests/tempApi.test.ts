import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { enableApiTemporarily } from "../src/tempApi.js";

const created: string[] = [];

afterEach(async () => {
  await Promise.all(
    created.map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
  created.length = 0;
});

describe("enableApiTemporarily", () => {
  it("applies and restores temporary API config", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "wiki-sync-test-"));
    created.push(dir);
    const localPhpPath = path.join(dir, "local.php");
    await fs.writeFile(localPhpPath, "<?php\n$conf['useacl'] = 1;\n", "utf8");

    const restore = await enableApiTemporarily(localPhpPath, "apiclient");
    const modified = await fs.readFile(localPhpPath, "utf8");
    expect(modified).toMatch(/\$conf\['remote'\] = 1;/);
    expect(modified).toMatch(/\$conf\['remoteuser'\] = 'apiclient';/);

    await restore();
    const restored = await fs.readFile(localPhpPath, "utf8");
    expect(restored).not.toMatch(/wiki-sync-temporary-start/);
    expect(restored).toContain("$conf['useacl'] = 1;");
  });
});
