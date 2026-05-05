import { describe, expect, it } from "vitest";
import {
  extractBulletField,
  normalizeDokuWikiLink,
  stripStructPlaceholders,
  isPlaceholder,
} from "../src/useCases/workingGroups.js";

describe("extractBulletField", () => {
  it("reads * **Label:** value lines", () => {
    const text = `
===== Contact Information =====
* **Primary contact email:**  
* **Intake form:**  https://actionnetwork.org/forms/join-nyc-afrosocialists-and-socialist-of-color-email-list
* **Website:**  https://afrosocnyc.carrd.co
* **Socials:**  afrosocnyc
`;
    expect(extractBulletField(text, "Intake form")).toBe(
      "https://actionnetwork.org/forms/join-nyc-afrosocialists-and-socialist-of-color-email-list",
    );
    expect(extractBulletField(text, "Website")).toBe("https://afrosocnyc.carrd.co");
    expect(extractBulletField(text, "Socials")).toBe("afrosocnyc");
  });
});

describe("wiki placeholders and links", () => {
  it("detects unresolved struct placeholders", () => {
    expect(isPlaceholder("{{$working_groups.email}}")).toBe(true);
    expect(isPlaceholder("a@b.co")).toBe(false);
  });

  it("strips struct placeholders from text", () => {
    expect(stripStructPlaceholders("Hello {{$working_groups.name}} world")).toBe("Hello world");
  });

  it("normalizes DokuWiki link syntax", () => {
    expect(normalizeDokuWikiLink("[[https://example.com/x|label]]")).toBe("https://example.com/x");
    expect(normalizeDokuWikiLink("[[https://example.com/x]]")).toBe("https://example.com/x");
  });
});
