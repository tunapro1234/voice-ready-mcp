// Rules that decide whether a tool reply can be read aloud by a voice assistant.
// Each rule returns a short human-readable problem, or nothing when the text passes.

export type TextProblem = string;

const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣|️/u;
const PIPE_RE = /\|/;
const URI_RE = /\b[a-z][a-z0-9+.-]*:\/\/\S+/i;
const BARE_WWW_RE = /\bwww\.[a-z0-9-]+\.[a-z]{2,}/i;

// Markdown is detected line by line, so that a stray asterisk inside a sentence is not flagged.
const MARKDOWN_LINE_RES: Array<[RegExp, string]> = [
  [/^\s{0,3}#{1,6}\s+\S/, "heading"],
  [/^\s*[-*+]\s+\S/, "bullet list"],
  [/^\s*\d+[.)]\s+\S/, "numbered list"],
  [/^\s*>\s?\S/, "block quote"],
  [/^\s*(```|~~~)/, "code fence"],
  [/^\s*([-*_])(\s*\1){2,}\s*$/, "horizontal rule"],
];
const MARKDOWN_INLINE_RES: Array<[RegExp, string]> = [
  [/\*\*[^*\n]+\*\*/, "bold"],
  [/__[^_\n]+__/, "bold"],
  [/`[^`\n]+`/, "inline code"],
  [/!?\[[^\]\n]+\]\([^)\n]+\)/, "link"],
];

/** Counts sentences ending in . ! or ?. Abbreviations such as "e.g. this" count as a split. */
export function countSentences(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  // A terminator splits only when whitespace or the end follows it, so "3.5" and "v1.2" stay whole.
  // A trailing terminator leaves an empty last part, which is not a sentence.
  return trimmed.split(/[.!?]+(?=\s|$)/).filter((p) => p.trim() !== "").length;
}

export function findEmoji(text: string): TextProblem[] {
  return EMOJI_RE.test(text) ? ["contains an emoji or pictograph"] : [];
}

export function findPipes(text: string): TextProblem[] {
  return PIPE_RE.test(text) ? ["contains a pipe character (|), often a table or separator"] : [];
}

export function findRawUris(text: string): TextProblem[] {
  const out: TextProblem[] = [];
  const m = URI_RE.exec(text);
  if (m) out.push(`contains a raw URI (${m[0].slice(0, 40)})`);
  else if (BARE_WWW_RE.test(text)) out.push("contains a raw web address (www.)");
  return out;
}

export function findMarkdown(text: string): TextProblem[] {
  const found = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    for (const [re, name] of MARKDOWN_LINE_RES) if (re.test(line)) found.add(name);
  }
  for (const [re, name] of MARKDOWN_INLINE_RES) if (re.test(text)) found.add(name);
  return [...found].map((name) => `contains markdown (${name})`);
}

export type SpeakableOptions = { maxChars: number; maxSentences?: number };

/** Returns every rule the text breaks. An empty array means the text is speakable. */
export function speakableProblems(text: string, options: SpeakableOptions): TextProblem[] {
  const maxSentences = options.maxSentences ?? 2;
  const problems = [
    ...findPipes(text),
    ...findMarkdown(text),
    ...findEmoji(text),
    ...findRawUris(text),
  ];
  const sentences = countSentences(text);
  if (sentences > maxSentences) problems.push(`has ${sentences} sentences, the limit is ${maxSentences}`);
  if (text.length > options.maxChars) problems.push(`has ${text.length} characters, the limit is ${options.maxChars}`);
  return problems;
}
