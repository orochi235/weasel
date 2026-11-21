import { describe, expect, it } from 'vitest';
import { lineContrast, painted } from './paintedContrast';

describe('painted', () => {
  it('composites a color over an opaque ground', () => {
    expect(painted('rgb(255 0 0 / 0.5)', '#0000ff')).toEqual([128, 0, 127]);
  });

  it('throws on a color the canvas cannot parse, rather than reading the ground back', () => {
    expect(() => painted('var(--wzl-accent)', 'magenta')).toThrow(/cannot parse/);
    expect(() => painted('', 'magenta')).toThrow(/cannot parse/);
    expect(() => painted('red', 'light-dark(red, blue)')).toThrow(/cannot parse/);
  });
});
