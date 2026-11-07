import { describe, it, expect } from 'vitest';
import { flattenTokens } from './flatten';

describe('flattenTokens', () => {
  it('drops the type group from the name and inherits $type', () => {
    const out = flattenTokens({
      color: { $type: 'color', 'fg-muted': { $value: '#9ea1a8' } },
    });
    expect(out).toEqual({
      'fg-muted': { type: 'color', value: '#9ea1a8', alpha: undefined, description: undefined },
    });
  });

  it('carries $description and the alpha extension through', () => {
    const out = flattenTokens({
      color: {
        $type: 'color',
        line: { $value: '{color.fg}', $description: 'gridlines', $extensions: { 'com.weasel.alpha': 0.2 } },
      },
    });
    expect(out.line.alpha).toBe(0.2);
    expect(out.line.description).toBe('gridlines');
    expect(out.line.value).toBe('{color.fg}');
  });

  it('preserves array and numeric values verbatim', () => {
    const out = flattenTokens({
      cubicBezier: { $type: 'cubicBezier', 'ease-out-cubic': { $value: [0.33, 1, 0.68, 1] } },
      fontWeight: { $type: 'fontWeight', 'font-weight-bold': { $value: 400 } },
    });
    expect(out['ease-out-cubic'].value).toEqual([0.33, 1, 0.68, 1]);
    expect(out['font-weight-bold'].value).toBe(400);
  });

  it('throws when a token has no resolvable $type', () => {
    expect(() => flattenTokens({ color: { fg: { $value: '#fff' } } }))
      .toThrow(/fg.*\$type/);
  });

  it('throws on a duplicate leaf name across type groups', () => {
    expect(() =>
      flattenTokens({
        color: { $type: 'color', line: { $value: '#fff' } },
        dimension: { $type: 'dimension', line: { $value: '2px' } },
      }),
    ).toThrow(/duplicate.*line/i);
  });

  it('throws on a leaf name a custom property cannot carry', () => {
    expect(() => flattenTokens({ dimension: { $type: 'dimension', 'font size': { $value: '12px' } } })).toThrow(
      /"font size" cannot name a token/,
    );
  });

  const valueOf = (type: string, $value: unknown) => flattenTokens({ g: { $type: type, t: { $value } } }).t.value;

  it('writes an object dimension or duration as a CSS length or time', () => {
    expect(valueOf('dimension', { value: 8, unit: 'px' })).toBe('8px');
    expect(valueOf('dimension', { value: 0.5, unit: 'rem' })).toBe('0.5rem');
    expect(valueOf('duration', { value: 120, unit: 'ms' })).toBe('120ms');
  });

  it('writes an object color in CSS’s own notation for its space, converting nothing', () => {
    expect(valueOf('color', { colorSpace: 'srgb', components: [1, 0, 0.5] })).toBe('#ff0080');
    expect(valueOf('color', { colorSpace: 'srgb', components: [1, 0, 0], alpha: 0.5 })).toBe('#ff000080');
    expect(valueOf('color', { colorSpace: 'oklch', components: [0.7, 0.3, 150] })).toBe('oklch(0.7 0.3 150)');
    expect(valueOf('color', { colorSpace: 'hsl', components: [210, 50, 40], alpha: 0.25 })).toBe('hsl(210 50% 40% / 0.25)');
    expect(valueOf('color', { colorSpace: 'display-p3', components: [1, 0, 0] })).toBe('color(display-p3 1 0 0)');
    expect(valueOf('color', { colorSpace: 'lch', components: [50, 0, 'none'] })).toBe('lch(50 0 none)');
  });

  it('keeps an sRGB color outside the gamut rather than clamping it into hex', () => {
    expect(valueOf('color', { colorSpace: 'srgb', components: [1.2, 0, -0.1] })).toBe('color(srgb 1.2 0 -0.1)');
  });

  it('throws naming the token for a value it cannot write as CSS', () => {
    expect(() => valueOf('color', { colorSpace: 'cmyk', components: [0, 0, 0, 1] })).toThrow(/"t".*cmyk/);
    expect(() => valueOf('shadow', { color: '#000', offsetX: '0px', offsetY: '1px', blur: '2px', spread: '0px' })).toThrow(/"t".*shadow/);
  });
});
