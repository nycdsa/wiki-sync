import type { ExtractionResult, NormalizedOutput } from "./types.js";

export function normalizeResult(args: { url: string; result: ExtractionResult }): NormalizedOutput {
  return {
    sourceUrl: args.url,
    pageId: args.result.pageId,
    extractedVia: args.result.source,
    extractedAt: new Date().toISOString(),
    payload: args.result.data,
  };
}
