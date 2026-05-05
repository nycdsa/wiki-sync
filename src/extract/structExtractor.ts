import { jsonRpcCall } from "../wikiClient.js";
import type { ExtractionResult } from "../types.js";

export async function extractViaJsonRpc(args: {
  host: string;
  pageId: string;
  token?: string;
}): Promise<ExtractionResult> {
  const page = await jsonRpcCall<string>(args.host, "wiki.getPage", [args.pageId], args.token);

  // Struct plugin method names can vary; try likely methods and continue if unavailable.
  const candidates = ["plugin.struct.getData", "plugin.struct.getPageData"];
  let structData: unknown = null;
  for (const method of candidates) {
    try {
      structData = await jsonRpcCall<unknown>(args.host, method, [args.pageId], args.token);
      break;
    } catch {
      // Keep trying methods; page content is still useful.
    }
  }

  return {
    source: "jsonrpc",
    pageId: args.pageId,
    data: {
      page,
      structData,
    },
  };
}
