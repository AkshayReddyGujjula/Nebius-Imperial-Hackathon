import { describe, expect, it } from "vitest";
import { parseJsonLoose } from "../src/llm/json";

describe("parseJsonLoose", () => {
  it("parses a fenced JSON object", () => {
    expect(parseJsonLoose('```json\n{"ok":true,"items":["a","b"]}\n```'))
      .toEqual({ ok: true, items: ["a", "b"] });
  });

  it("ignores a leading think block, including braces inside reasoning", () => {
    expect(parseJsonLoose('<think>Consider {a candidate} first.</think>\n{"answer":"attend"}'))
      .toEqual({ answer: "attend" });
  });

  it("repairs trailing commas in objects and arrays", () => {
    expect(parseJsonLoose('{"items":["a","b",],"ok":true,}'))
      .toEqual({ items: ["a", "b"], ok: true });
  });

  it("throws when no JSON object is present", () => {
    for (const text of ["", "There is no JSON here.", "[]", "<think>Still thinking.</think>"]) {
      expect(() => parseJsonLoose(text)).toThrow("No JSON object found in model output");
    }
  });
});
