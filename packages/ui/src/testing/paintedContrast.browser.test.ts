import { describe, expect, it } from 'vitest';
import { lineContrast, painted } from './paintedContrast';

describe('painted', () => {
  it('composites a color over an opaque ground', () => {
    const [r, g, b] = painted('rgb(255 0 0 / 0.5)', '#0000ff');
    expect([Math.abs(r - 127.5) <= 1, g, Math.abs(b - 127.5) <= 1]).toEqual([true, 0, true]);
  });

  it('throws on a color the canvas cannot parse, rather than reading the ground back', () => {
    expect(() => painted('var(--wzl-accent)', 'magenta')).toThrow(/cannot parse/);
    expect(() => painted('', 'magenta')).toThrow(/cannot parse/);
    expect(() => painted('red', 'light-dark(red, blue)')).toThrow(/cannot parse/);
  });

  it('throws on a translucent ground unless given the backdrop under it', () => {
    expect(() => painted('black', 'rgba(255, 255, 255, 0.5)')).toThrow(/not opaque/);
    expect(() => lineContrast('black', 'transparent')).toThrow(/not opaque/);
    for (const channel of painted('rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.5)', 'black')) expect(Math.abs(channel - 191.5)).toBeLessThanOrEqual(1);
  });
});

describe('lineContrast', () => {
  it('measures against the fill painted once over its backdrop', () => {
    // White at half over black is 50% gray, whose contrast with black is about 5.3; painting it twice gives 75% gray.
    expect(lineContrast('black', 'rgba(255, 255, 255, 0.5)', 'black')).toBeCloseTo(5.32, 1);
  });
});
