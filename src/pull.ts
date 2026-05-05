import path from "node:path";
import { ensureAbsolutePath, writeJsonAtomic } from "./io.js";
import { enableApiTemporarily } from "./tempApi.js";
import { mintJwtToken } from "./wikiClient.js";
import type { PullOptions } from "./types.js";
import { buildWorkingGroupsPayload } from "./useCases/workingGroups.js";

const SUPPORTED_USE_CASES = new Set(["working-groups"]);

export async function pullUseCase(options: PullOptions): Promise<{ outputPath: string; useCase: string }> {
  if (!SUPPORTED_USE_CASES.has(options.useCase)) {
    throw new Error(`Unsupported use case "${options.useCase}". Supported values: working-groups`);
  }

  const outputPath = ensureAbsolutePath(options.out);
  const dokuwikiRoot = options.dokuwikiRoot ? path.resolve(options.dokuwikiRoot) : path.resolve("../dokuwiki");
  const wikiDataRoot = path.join(dokuwikiRoot, "data");
  const wikiConfRoot = options.wikiConfRoot ? path.resolve(options.wikiConfRoot) : path.resolve("../wiki-conf");
  const localPhpPath = path.join(dokuwikiRoot, "conf", "local.php");

  let restoreConfig: undefined | (() => Promise<void>);
  try {
    let token = options.token ?? process.env.WIKI_SYNC_TOKEN;
    if (!token && options.enableApiTemp) {
      restoreConfig = await enableApiTemporarily(localPhpPath, options.apiUser);
      token = await mintJwtToken({
        dokuwikiRoot,
        wikiConfRoot,
        user: options.apiUser,
      });
    }

    if (options.useCase !== "working-groups") {
      throw new Error(`No handler for use case "${options.useCase}"`);
    }

    const payload = await buildWorkingGroupsPayload({
        host: options.host,
        token,
        wikiDataRoot,
      });
    await writeJsonAtomic(outputPath, payload);
    return {
      outputPath,
      useCase: options.useCase,
    };
  } finally {
    if (restoreConfig) await restoreConfig();
  }
}
