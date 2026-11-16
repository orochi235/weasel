/**
 * An embedded face's family survives the trip through the `@font-face` rule `fontFacesXml` writes: the document
 * parses as XML, and the rule's CSS string reads back as the family.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fontFacesXml, type EmbeddedFace } from './textModes';

const face = (family: string): EmbeddedFace => ({
  family,
  weight: 400,
  style: 'normal',
  embedding: { sfnt: new ArrayBuffer(4), outlines: 'truetype' } as EmbeddedFace['embedding'],
});

/** The CSS string token opening `css` at `start`, decoded as CSS Syntax §4.3.5 reads it. */
function readCssString(css: string, start: number): string {
  const quote = css[start]!;
  let out = '';
  for (let i = start + 1; i < css.length; i++) {
    const c = css[i]!;
    if (c === quote) return out;
    if (c === '\n') throw new Error('a raw line break ends the string as a bad-string');
    if (c !== '\\') {
      out += c;
      continue;
    }
    const hex = /^[0-9a-fA-F]{1,6}/.exec(css.slice(i + 1));
    if (hex) {
      const cp = parseInt(hex[0], 16);
      out += String.fromCodePoint(cp === 0 || (cp >= 0xd800 && cp <= 0xdfff) || cp > 0x10ffff ? 0xfffd : cp);
      i += hex[0].length;
      if (/\s/.test(css[i + 1] ?? '')) i++;
    } else {
      out += css[++i] ?? '';
    }
  }
  throw new Error('unterminated string');
}

function familyRead(family: string): string {
  const xml = `<svg xmlns="http://www.w3.org/2000/svg">${fontFacesXml([face(family)])}</svg>`;
  const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  const css = doc.getElementsByTagName('style')[0]!.textContent!;
  return readCssString(css, css.indexOf('font-family:') + 'font-family:'.length);
}

/** CSS reads a NUL or half a surrogate pair as U+FFFD however it is written. */
const asCssKeeps = (s: string): string =>
  s.replace(/\0|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�');

describe('fontFacesXml', () => {
  it.each([
    ['a line feed', 'Font\nName'],
    ['a carriage return', 'Font\rName'],
    ['a form feed', 'Font\fName'],
    ['a C0 control', 'Font\u0001Name'],
    ['markup', 'A<b>&c'],
    ['a quote and a backslash', 'a"b\\c'],
  ])('writes a family holding %s that reads back as itself', (_, family) => {
    expect(familyRead(family)).toBe(family);
  });

  it('writes every family so it reads back as itself', () => {
    fc.assert(fc.property(fc.string({ unit: 'binary', maxLength: 24 }), (family) => {
      expect(familyRead(family)).toBe(asCssKeeps(family));
    }));
  });
});
