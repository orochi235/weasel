/**
 * `cssFamilyName` over family names of any characters, backslashes, line breaks, controls, astral and unpaired
 * code points included: CSS's own tokenizer, modeled here from CSS Syntax 3 (4.3.5, a string token), reads the
 * quoted name back as the name, and a generic keyword stays a bare keyword.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { cssFamilyName } from './cssFamily';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 500;
const HEX = /^[0-9a-fA-F]$/;
const NEWLINE = /^[\n\r\f]$/;

/** The value of the CSS string token `css` opens with, or null when it is not one string token and nothing after. */
function readCssString(css: string): string | null {
  const q = css[0];
  if (q !== '"' && q !== "'") return null;
  let out = '';
  for (let i = 1; i < css.length;) {
    const c = css[i]!;
    if (c === q) return i === css.length - 1 ? out : null;
    if (NEWLINE.test(c)) return null;
    if (c !== '\\') { out += c; i++; continue; }
    const next = css[i + 1];
    if (next === undefined) return null;
    if (NEWLINE.test(next)) { i += next === '\r' && css[i + 2] === '\n' ? 3 : 2; continue; }
    if (!HEX.test(next)) {
      const cp = css.codePointAt(i + 1)!;
      out += String.fromCodePoint(cp);
      i += cp > 0xffff ? 3 : 2;
      continue;
    }
    let j = i + 1;
    while (j < css.length && j < i + 7 && HEX.test(css[j]!)) j++;
    const cp = parseInt(css.slice(i + 1, j), 16);
    out += cp === 0 || (cp >= 0xd800 && cp <= 0xdfff) || cp > 0x10ffff ? '�' : String.fromCodePoint(cp);
    if (css[j] === ' ' || css[j] === '\t' || css[j] === '\n') j++;
    i = j;
  }
  return null;
}

const unit = fc.oneof(
  fc.constantFrom('\\', '\n', '\r', '\f', '\t', ' ', '\x7f', '\x01', 'a', ' ', '0', 'f', '\ud800', '😀', 'é'),
  fc.string({ unit: 'binary', minLength: 1, maxLength: 1 }),
);
const name = fc.string({ unit, minLength: 1, maxLength: 10 }).filter((s) => !/[,"'\0]/.test(s));

describe('cssFamilyName, property', () => {
  it('quotes a named family so CSS reads back the name, and leaves a generic keyword bare', () => {
    const t = tally();
    fc.assert(fc.property(fc.oneof(name, fc.constantFrom('serif', ' Sans-Serif ', 'ui-monospace')), (family) => {
      const css = cssFamilyName(family);
      if (css[0] !== '"') {
        expect(css).toBe(family.trim());
        return t.count('generic');
      }
      expect(readCssString(css)).toBe(family);
      if (/[\\\n\r\f]/.test(family)) t.count('escaped');
    }), runs(RUNS));
    t.atLeast('generic', 20);
    t.atLeast('escaped', 100);
  }, timeoutFor(RUNS, 1));
});
