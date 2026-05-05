import { spawn } from "node:child_process";

type JsonRpcResponse<T> = {
  result?: T;
  error?: { code: number; message: string };
};

export async function jsonRpcCall<T>(
  host: string,
  method: string,
  params: unknown[] = [],
  token?: string,
): Promise<T> {
  const endpoint = new URL("/lib/exe/jsonrpc.php", host).toString();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!res.ok) {
    throw new Error(`JSON-RPC HTTP ${res.status} ${res.statusText} from ${endpoint}`);
  }

  const payload = (await res.json()) as JsonRpcResponse<T>;
  if (payload.error) {
    throw new Error(`JSON-RPC ${method} failed: ${payload.error.message}`);
  }
  if (typeof payload.result === "undefined") {
    throw new Error(`JSON-RPC ${method} returned no result.`);
  }
  return payload.result;
}

export async function mintJwtToken(args: {
  wikiConfRoot: string;
  dokuwikiRoot: string;
  user: string;
}): Promise<string> {
  const script = `${args.wikiConfRoot}/scripts/issue_jwt_token.php`;
  return new Promise<string>((resolve, reject) => {
    const child = spawn("php", [script, args.user], {
      env: { ...process.env, DOKUWIKI_ROOT: args.dokuwikiRoot },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Failed minting JWT token (${code}): ${stderr.trim()}`));
        return;
      }
      const token = stdout.trim();
      if (!token) {
        reject(new Error("JWT minting returned an empty token."));
        return;
      }
      resolve(token);
    });
  });
}
