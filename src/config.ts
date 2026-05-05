import path from "node:path";
import { z } from "zod";
import type { PullOptions } from "./types.js";

const pullSchema = z.object({
  useCase: z.string().min(1),
  out: z.string().min(1),
  host: z.string().url(),
  token: z.string().min(1).optional(),
  dokuwikiRoot: z.string().min(1).optional(),
  wikiConfRoot: z.string().min(1).optional(),
  apiUser: z.string().min(1),
  enableApiTemp: z.boolean(),
  verbose: z.boolean(),
});

export function resolveDefaults(input: Omit<PullOptions, "host"> & { host?: string }): PullOptions {
  const parsed = pullSchema.parse({
    ...input,
    host: input.host ?? "http://127.0.0.1:8765",
  });

  return {
    ...parsed,
    dokuwikiRoot: parsed.dokuwikiRoot ? path.resolve(parsed.dokuwikiRoot) : undefined,
    wikiConfRoot: parsed.wikiConfRoot ? path.resolve(parsed.wikiConfRoot) : undefined,
  };
}
