import { describe, expect, it } from "vitest";
import { ensureAbsolutePath } from "../src/io.js";

describe("ensureAbsolutePath", () => {
  it("throws for relative paths", () => {
    expect(() => ensureAbsolutePath("relative/file.json")).toThrow(/absolute/);
  });
});
