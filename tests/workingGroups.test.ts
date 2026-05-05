import { describe, expect, it } from "vitest";
import { extractBulletField } from "../src/useCases/workingGroups.js";

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
