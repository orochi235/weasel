import { describe, expect, it } from 'vitest';
import { hexColor } from '../graphWrite';
import { dotColor, labelLines, quoteLabel } from './values';

describe('DOT values', () => {
  it('writes CSS colors DOT cannot read as hex', () => {
    expect(hexColor('rgba(123, 167, 199, 0.08)')).toBe('#7ba7c714');
    expect(hexColor('rgb(255 0 0 / 50%)')).toBe('#ff000080');
    expect(hexColor('#abc')).toBe('#aabbcc');
    expect(hexColor('steelblue')).toBe('steelblue');
    expect(hexColor('rgb(100% 0% 50%)')).toBe('#ff0080');
    expect(hexColor('rgb(var(--x) 0 0)')).toBe('rgb(var(--x) 0 0)');
    expect(hexColor('hsl(120, 100%, 50%)')).toBe('#00ff00');
    expect(hexColor('hsl(0 100% 50% / 0.5)')).toBe('#ff000080');
    expect(hexColor('oklch(0.628 0.2577 29.23)')).toMatch(/^#[0-9a-f]{6}$/);
    expect(hexColor('color(srgb 0 0 1)')).toBe('#0000ff');
  });

  it('writes a name as hex where DOT would read it as another X11 color', () => {
    expect(hexColor('green')).toBe('green');
    expect(hexColor('green', 'hex')).toBe('#008000');
    expect(hexColor('transparent', 'hex')).toBe('transparent');
    expect(dotColor(hexColor('gray', 'hex'))).toBe('#808080');
  });

  it('reads a bare or X11 name as Graphviz draws it, and an SVG one as CSS', () => {
    expect(dotColor('green')).toBe('#00ff00');
    expect(dotColor('/x11/Gray')).toBe('#bebebe');
    expect(dotColor('purple')).toBe('#a020f0');
    expect(dotColor('/svg/green')).toBe('green');
    expect(dotColor('gray50')).toBe('#7f7f7f');
    expect(dotColor('gray90')).toBe('#e5e5e5');
    expect(dotColor('grey100')).toBe('#ffffff');
    expect(dotColor('steelblue')).toBe('steelblue');
  });

  it('reads back what it writes', () => {
    expect(dotColor(hexColor('rgba(0, 0, 255, 1)'))).toBe('#0000ffff');
    const lines = ['say "hi"', 'back\\slash'];
    expect(labelLines({ value: quoteLabel(lines).slice(1, -1), quoted: true }, 'n', 'g')).toEqual(lines);
  });
});
