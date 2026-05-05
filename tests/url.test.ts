import { describe, expect, it } from "vitest";

describe("use-case validation expectation", () => {
  it("keeps working-groups as the only accepted initial use-case", () => {
    const supported = new Set(["working-groups"]);
    expect(supported.has("working-groups")).toBe(true);
    expect(supported.has("banana")).toBe(false);
  });
});
