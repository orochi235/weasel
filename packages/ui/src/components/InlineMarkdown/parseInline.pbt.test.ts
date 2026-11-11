/**
 * Property tests of the inline markdown reader: any line reads without throwing into tidy tokens, and a token tree
 * written out as markdown, its text escaped, reads back as itself.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { inlineMarkdownText, parseInline, type InlineToken } from './parseInline';

const RUNS = 300;
const SAFE = /^(https?:|mailto:|[/#.])/i;

/** Every text token non-empty, no two side by side, and every link's address one the reader lets through. */
function tidy(tokens: readonly InlineToken[]): void {
  tokens.forEach((t, i) => {
    if (t.type === 'text') {
      expect(t.text).not.toBe('');
      expect(tokens[i + 1]?.type).not.toBe('text');
    }
    if (t.type === 'link') expect(t.href).toMatch(SAFE);
    if ('children' in t) tidy(t.children);
  });
}

const mdChars = fc.constantFrom(...'ab *_~`[]()\\<>/#.:!'.split(''), '**', '~~', '<kbd>', '</kbd>', '](', 'http:', 'javascript:');

describe('parseInline', () => {
  it('reads any line into tidy tokens without throwing', () => {
    const t = tally();
    fc.assert(fc.property(fc.oneof(fc.string(), { arbitrary: fc.array(mdChars, { maxLength: 24 }).map((a) => a.join('')), weight: 4 }), (src) => {
      const tokens = parseInline(src);
      tidy(tokens);
      if (tokens.some((x) => x.type !== 'text')) t.count('marked');
      expect(typeof inlineMarkdownText(src)).toBe('string');
    }), runs(RUNS));
    t.atLeast('marked', 4);
  }, timeoutFor(RUNS, 1));
});

const ESCAPED = /[`*~[\]\\]/g;
const letter = fc.constantFrom(...'abcxyz019'.split(''));
/** Plain text, marks' own characters among it, with no `<` to start a tag. */
const word = fc.array(fc.constantFrom(...'abcxyz09 *~`[]\\()!.:_'.split('')), { minLength: 1, maxLength: 6 }).map((a) => a.join(''));
const codeText = fc.array(fc.constantFrom(...'abc09 .-_()+'.split('')), { minLength: 1, maxLength: 6 }).map((a) => a.join(''));
const chord = fc.array(fc.constantFrom('Mod', 'Shift', 'Alt', 'Z', 'K', '1'), { minLength: 1, maxLength: 3 }).map((a) => a.join('+'));
const href = fc.constantFrom('https://example.com/a', 'http://x.y', 'mailto:a@b.c', '#top', '/docs/a', './b', '../c');

/** A run of leaves, merged as the reader merges them, a mark's ends kept clear of spaces. */
function run(leaves: InlineToken[], edged: boolean): InlineToken[] {
  const out: InlineToken[] = [];
  for (const l of leaves) {
    const last = out.at(-1);
    if (l.type === 'text' && last?.type === 'text') last.text += l.text;
    else out.push(l.type === 'text' ? { ...l } : l);
  }
  if (edged) {
    const first = out[0];
    if (first?.type === 'text') first.text = first.text.replace(/^\s+/, '') || 'a';
    const last = out.at(-1);
    if (last?.type === 'text') last.text = last.text.replace(/\s+$/, '') || 'a';
  }
  return out;
}

const leaf: fc.Arbitrary<InlineToken> = fc.oneof(
  { arbitrary: word.map((text) => ({ type: 'text' as const, text })), weight: 3 },
  codeText.map((text) => ({ type: 'code' as const, text })),
  chord.map((c) => ({ type: 'keys' as const, chord: c })),
);
const mark: fc.Arbitrary<InlineToken> = fc.tuple(fc.constantFrom('strong', 'em', 'del' as const), fc.array(leaf, { minLength: 1, maxLength: 3 }))
  .map(([type, kids]) => ({ type, children: run(kids, true) }));
const link: fc.Arbitrary<InlineToken> = fc.tuple(href, fc.array(fc.oneof(leaf, mark), { minLength: 1, maxLength: 3 }))
  .map(([h, kids]) => ({ type: 'link' as const, href: h, children: run(kids, false) }));

/** A line's tokens, with no two marks of one kind side by side, which the syntax cannot tell from one. */
const line = fc.array(fc.oneof({ arbitrary: leaf, weight: 2 }, mark, link), { maxLength: 6 }).map((ts) => {
  const out: InlineToken[] = [];
  for (const t of ts) {
    const last = out.at(-1);
    if (last && last.type === t.type && 'children' in t) out.push({ type: 'text', text: ' ' });
    out.push(t);
  }
  return run(out, false);
});

function write(tokens: readonly InlineToken[]): string {
  return tokens.map((t) => {
    switch (t.type) {
      case 'text': return t.text.replace(ESCAPED, (c) => `\\${c}`);
      case 'code': return `\`${t.text}\``;
      case 'keys': return `<kbd>${t.chord}</kbd>`;
      case 'strong': return `**${write(t.children)}**`;
      case 'em': return `*${write(t.children)}*`;
      case 'del': return `~~${write(t.children)}~~`;
      case 'link': return `[${write(t.children)}](${t.href})`;
    }
  }).join('');
}

const flat = (ts: readonly InlineToken[]): string =>
  ts.map((t) => (t.type === 'text' || t.type === 'code' ? t.text : t.type === 'keys' ? t.chord : flat(t.children))).join('');

describe('parseInline, read back', () => {
  it('reads a written token tree back as itself', () => {
    const t = tally();
    fc.assert(fc.property(line, (tokens) => {
      const src = write(tokens);
      expect(parseInline(src)).toEqual(tokens);
      expect(inlineMarkdownText(src)).toBe(flat(tokens));
      for (const x of tokens) t.count(x.type);
      if (tokens.some((x) => 'children' in x && x.children.some((c) => c.type === 'text' && ESCAPED.test(c.text)))) t.count('escape in a mark');
      ESCAPED.lastIndex = 0;
    }), runs(RUNS));
    for (const k of ['text', 'code', 'keys', 'strong', 'em', 'del', 'link', 'escape in a mark']) t.atLeast(k, 20);
  }, timeoutFor(RUNS, 2));

  it('writes a link to an address it refuses as its label alone', () => {
    fc.assert(fc.property(fc.constantFrom('javascript:alert(1)', 'data:x', 'vbscript:x', 'file:a'), word, (h, label) => {
      const text = label.replace(ESCAPED, (c) => `\\${c}`);
      expect(inlineMarkdownText(`[${text}](${h.replace(/[()]/g, '')})`)).toBe(label);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('parseInline, shrunk', () => {
  it('keeps an escaped bracket inside a link label', () => {
    expect(parseInline('[**\\]**](https://example.com/a)')).toEqual([
      { type: 'link', href: 'https://example.com/a', children: [{ type: 'strong', children: [{ type: 'text', text: ']' }] }] },
    ]);
    expect(inlineMarkdownText('[\\]a](javascript:alert1)')).toBe(']a');
  });

  it('keeps an escaped mark inside a mark', () => {
    expect(parseInline('**a\\***')).toEqual([{ type: 'strong', children: [{ type: 'text', text: 'a*' }] }]);
    expect(parseInline('*a\\*b*')).toEqual([{ type: 'em', children: [{ type: 'text', text: 'a*b' }] }]);
  });
});
