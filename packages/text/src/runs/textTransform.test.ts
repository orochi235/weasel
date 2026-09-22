import { describe, it, expect } from 'vitest';
import { transformRunTexts, type TextTransform } from './textTransform';

function one(text: string, transform: TextTransform) {
  return transformRunTexts([text], [transform])[0];
}

describe('transformRunTexts', () => {
  it('leaves text alone under none', () => {
    expect(one('Hello ß', 'none')).toEqual({ text: 'Hello ß' });
  });

  it('upper- and lowercases with the full locale-independent mappings', () => {
    expect(one('straße', 'uppercase').text).toBe('STRASSE');
    expect(one('ﬁne', 'uppercase').text).toBe('FINE');
    expect(one('İx', 'lowercase').text).toBe('İx'.toLowerCase());
  });

  it('carries no source map when every code point kept its length', () => {
    expect(one('hello', 'uppercase')).toEqual({ text: 'HELLO' });
    expect(one('HELLO', 'lowercase')).toEqual({ text: 'hello' });
  });

  it('maps both halves of an expansion back to the one source character', () => {
    const out = one('aßb', 'uppercase');
    expect(out.text).toBe('ASSB');
    expect(out.srcMap).toEqual({ length: 3, starts: [0, 1, 1, 2], ends: [1, 2, 2, 3] });
  });

  it('keeps an astral code point as one source span', () => {
    // U+10428 DESERET SMALL LETTER LONG I uppercases to U+10400, both two units.
    const out = one('ß\u{10428}', 'uppercase');
    expect(out.text).toBe('SS\u{10400}');
    expect(out.srcMap).toEqual({ length: 3, starts: [0, 0, 1, 1], ends: [1, 1, 3, 3] });
  });

  it('lowercases a word-final capital sigma to final sigma', () => {
    expect(one('ΟΔΟΣ ΣΑ', 'lowercase').text).toBe('οδος σα');
  });

  it('reads final-sigma context across a run boundary', () => {
    // The sigma is word-final only if nothing cased follows — in the next run.
    const [a] = transformRunTexts(['ΟΔΟΣ', 'Α'], ['lowercase', 'none']);
    expect(a.text).toBe('οδοσ');
    const [b] = transformRunTexts(['ΟΔΟΣ', ' Α'], ['lowercase', 'none']);
    expect(b.text).toBe('οδος');
  });

  it('capitalizes the first letter unit of each word and nothing else', () => {
    expect(one('hello wORLD', 'capitalize').text).toBe('Hello WORLD');
    expect(one('(quoted) well-known', 'capitalize').text).toBe('(Quoted) Well-Known');
    expect(one('don’t', 'capitalize').text).toBe('Don’t');
  });

  it('leaves a word alone when its first unit is not a letter', () => {
    expect(one('1st place', 'capitalize').text).toBe('1st Place');
  });

  it('capitalizes to titlecase, not uppercase', () => {
    expect(one('ǆungla', 'capitalize').text).toBe('ǅungla');
    const sharp = one('ßa', 'capitalize');
    expect(sharp.text).toBe('Ssa');
    expect(sharp.srcMap).toEqual({ length: 2, starts: [0, 0, 1], ends: [1, 1, 2] });
    expect(one('ﬁne', 'capitalize').text).toBe('Fine');
  });

  it('finds word starts across runs, so a word split by styling gets one capital', () => {
    const out = transformRunTexts(['hel', 'lo world'], ['capitalize', 'capitalize']);
    expect(out.map((r) => r.text)).toEqual(['Hel', 'lo World']);
  });

  it('only transforms the runs that ask for it', () => {
    const out = transformRunTexts(['ab ', 'cd ', 'eß'], ['none', 'uppercase', 'capitalize']);
    expect(out.map((r) => r.text)).toEqual(['ab ', 'CD ', 'Eß']);
  });
});
