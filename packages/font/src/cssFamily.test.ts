import { describe, expect, it } from 'vitest';
import { cssFamilyName, cssUnescape, fontFamilies, isGenericFamily } from './cssFamily';

describe('cssFamilyName', () => {
  it('leaves generic keywords bare, in any case', () => {
    expect(cssFamilyName('sans-serif')).toBe('sans-serif');
    expect(cssFamilyName('ui-monospace')).toBe('ui-monospace');
    expect(cssFamilyName('Serif')).toBe('Serif');
  });

  it('quotes a named family', () => {
    expect(cssFamilyName('Inter')).toBe('"Inter"');
    expect(cssFamilyName('Font 3D')).toBe('"Font 3D"');
  });

  it('quotes a name holding a quote that does not open it', () => {
    expect(cssFamilyName("Hoefler's Text")).toBe('"Hoefler\'s Text"');
    expect(cssFamilyName('a "quoted" face')).toBe('"a \\"quoted\\" face"');
  });

  it('passes a family list or an already-quoted name through', () => {
    expect(cssFamilyName('system-ui, sans-serif')).toBe('system-ui, sans-serif');
    expect(cssFamilyName('"Comic Sans MS"')).toBe('"Comic Sans MS"');
  });
});

describe('isGenericFamily', () => {
  it('answers for a generic keyword in any case and spacing, and no named family', () => {
    expect(['sans-serif', ' System-UI ', 'ui-sans-serif'].map(isGenericFamily)).toEqual([true, true, true]);
    expect(['Inter', 'sans serif', '"sans-serif"'].map(isGenericFamily)).toEqual([false, false, false]);
  });
});

describe('fontFamilies', () => {
  it('splits a list into its names, unquoted', () => {
    expect(fontFamilies("Oswald, 'Arial Narrow', sans-serif")).toEqual(['Oswald', 'Arial Narrow', 'sans-serif']);
  });

  it('keeps a comma inside quotes, an escape or a function', () => {
    expect(fontFamilies('"A, B", serif')).toEqual(['A, B', 'serif']);
    expect(fontFamilies('A\\, B, serif')).toEqual(['A, B', 'serif']);
    expect(fontFamilies('var(--x, Oswald), serif')).toEqual(['var(--x, Oswald)', 'serif']);
  });

  it('resolves escapes, in quotes and out', () => {
    expect(fontFamilies('"Foo\\"s Sans", \'O\\\'Neil\'')).toEqual(['Foo"s Sans', "O'Neil"]);
    expect(fontFamilies('"\\41 B", Foo\\ Bar')).toEqual(['AB', 'Foo Bar']);
  });

  it('reads an unquoted name\'s whitespace as one space and drops empty entries', () => {
    expect(fontFamilies('  Helvetica   Neue ,, serif ,')).toEqual(['Helvetica Neue', 'serif']);
    expect(fontFamilies('')).toEqual([]);
  });
});

describe('cssUnescape', () => {
  it('replaces a code point out of range with U+FFFD', () => {
    expect(cssUnescape('\\0 \\d800 \\110000')).toBe('\ufffd\ufffd\ufffd');
  });
});
