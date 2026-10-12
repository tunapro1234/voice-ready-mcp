import { describe, it, expect } from "vitest";
import { countSentences, findEmoji, findMarkdown, findPipes, findRawUris, speakableProblems } from "../src/text-rules.ts";

describe("countSentences", () => {
  it("counts zero sentences in empty text", () => {
    expect(countSentences("   ")).toBe(0);
  });
  it("counts one sentence without a terminator", () => {
    expect(countSentences("Your order is on its way")).toBe(1);
  });
  it("counts two sentences ending in . and ?", () => {
    expect(countSentences("It shipped. Do you want the tracking number?")).toBe(2);
  });
  it("keeps decimal numbers and versions inside one sentence", () => {
    expect(countSentences("The price is 3.5 pounds and v1.2 is out.")).toBe(1);
  });
});

describe("text rules", () => {
  it("flags emoji and pictographs", () => {
    expect(findEmoji("Shipped \u{1F69A}")).toHaveLength(1);
    expect(findEmoji("Shipped.")).toHaveLength(0);
  });
  it("flags raw URIs and bare web addresses", () => {
    expect(findRawUris("See https://example.com/a for more.")).toHaveLength(1);
    expect(findRawUris("Open ui://voice-ready/dashboard now.")).toHaveLength(1);
    expect(findRawUris("Visit www.example.com today.")).toHaveLength(1);
    expect(findRawUris("Visit the example site.")).toHaveLength(0);
  });
  it("flags markdown headings, lists, bold, code and links", () => {
    expect(findMarkdown("# Title")).not.toHaveLength(0);
    expect(findMarkdown("- one\n- two")).not.toHaveLength(0);
    expect(findMarkdown("This is **bold** text.")).not.toHaveLength(0);
    expect(findMarkdown("Run `npm test` now.")).not.toHaveLength(0);
    expect(findMarkdown("See [the page](https://x.test).")).not.toHaveLength(0);
  });
  it("does not flag a plain sentence with a stray asterisk or hyphen", () => {
    expect(findMarkdown("Rated 4 * out of 5 - good.")).toHaveLength(0);
  });
  it("flags pipes", () => {
    expect(findPipes("a | b")).toHaveLength(1);
    expect(findPipes("a and b")).toHaveLength(0);
  });
  it("passes a short plain reply", () => {
    expect(speakableProblems("Your order arrives on Tuesday.", { maxChars: 240 })).toEqual([]);
  });
  it("reports sentence and length limits together", () => {
    const problems = speakableProblems("One. Two. Three.", { maxChars: 5 });
    expect(problems.some((p) => p.includes("3 sentences"))).toBe(true);
    expect(problems.some((p) => p.includes("characters"))).toBe(true);
  });
});
