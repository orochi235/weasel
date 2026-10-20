import { describe, expect, it } from 'vitest';
import { hexColor } from '../graphWrite';
import { dotColor, labelLines, quoteLabel } from './values';

describe('DOT values', () => {
  it('writes CSS colors DOT cannot read as hex', () => {
    expect(hexColor('rgba(123, 167, 199, 0.08)')).toBe('#7ba7c714');
    expect(hexColor('rgb(255 0 0 / 50%)')).toBe('#ff000080');
    expect(hexColor('#abc')).toBe('#aabbcc');
    expect(hexColor('steelblue')).toBe('steelblue');
  });

  it('reads back what it writes', () => {
    expect(dotColor(hexColor('rgba(0, 0, 255, 1)'))).toBe('#0000ffff');
    const lines = ['say "hi"', 'back\\slash'];
    expect(labelLines({ value: quoteLabel(lines).slice(1, -1), quoted: true }, 'n', 'g')).toEqual(lines);
  });
});
