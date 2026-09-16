import { describe, expect, it } from 'vitest';
import { parseTokenValue, serializeTokenValue } from './value';

describe('serializeTokenValue', () => {
  it('renders a cubic bezier the way a stylesheet spells it', () => {
    expect(serializeTokenValue('cubicBezier', [0.33, 1, 0.68, 1])).toBe('cubic-bezier(0.33, 1, 0.68, 1)');
  });

  it('quotes only the family names holding whitespace', () => {
    expect(serializeTokenValue('fontFamily', ['Oswald', 'Helvetica Neue Condensed', '-apple-system', 'sans-serif'])).toBe(
      "Oswald, 'Helvetica Neue Condensed', -apple-system, sans-serif",
    );
  });

  it('joins any other list with commas', () => {
    expect(serializeTokenValue('string', ['a', 'b'])).toBe('a, b');
  });

  it('stringifies a scalar', () => {
    expect(serializeTokenValue('dimension', '8px')).toBe('8px');
    expect(serializeTokenValue('number', 4)).toBe('4');
  });
});

describe('parseTokenValue', () => {
  it('reads a cubic bezier back as its four numbers', () => {
    expect(parseTokenValue('cubicBezier', 'cubic-bezier(0.1, 0.2, 0.3, 0.4)')).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it('keeps a half-typed bezier as text rather than throwing it away', () => {
    expect(parseTokenValue('cubicBezier', 'cubic-bezier(0.1, 0.2')).toBe('cubic-bezier(0.1, 0.2');
  });

  it('strips the quotes a font stack carries', () => {
    expect(parseTokenValue('fontFamily', "Inter, 'Helvetica Neue', sans-serif")).toEqual([
      'Inter',
      'Helvetica Neue',
      'sans-serif',
    ]);
  });

  it('leaves anything else as the text it was', () => {
    expect(parseTokenValue('color', '  #123456 ')).toBe('#123456');
  });

  it('round-trips the values weasel actually pins', () => {
    for (const [type, value] of [
      ['cubicBezier', [0.33, 1, 0.68, 1]],
      ['fontFamily', ['Oswald', 'Helvetica Neue Condensed', 'system-ui', 'sans-serif']],
    ] as const) {
      expect(parseTokenValue(type, serializeTokenValue(type, value))).toEqual(value);
    }
  });
});
