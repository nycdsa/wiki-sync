export function parsePageIdFromUrl(input: string): string {
  const url = new URL(input);
  const fromQuery = url.searchParams.get("id");
  if (fromQuery) return fromQuery.trim();

  const parts = url.pathname.split("/").filter(Boolean);
  const dokuPhpIndex = parts.findIndex((part) => part === "doku.php");
  if (dokuPhpIndex >= 0 && parts[dokuPhpIndex + 1]) {
    return decodeURIComponent(parts.slice(dokuPhpIndex + 1).join(":"));
  }

  const last = parts.at(-1);
  if (!last) {
    throw new Error(`Could not infer page id from URL: ${input}`);
  }

  return decodeURIComponent(last).replaceAll("/", ":");
}
