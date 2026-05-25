import { describe, it, expect } from 'vitest';
import { computeScrubbedPaints } from './computeScrubbedPaints';

describe('computeScrubbedPaints', () => {
  it('scales both alphas by the same factor, preserving ratio', () => {
    // fill α=0.8, stroke α=0.4 → ratio 2:1
    // target brightest = 0.4 → factor 0.5 → fill α=0.4, stroke α=0.2
    const out = computeScrubbedPaints(
      { fill: '#ff0000cc', stroke: '#00ff0066' }, // 0xcc=204≈0.8, 0x66=102≈0.4
      0.4,
    );
    expect(out.fill!.slice(-2).toLowerCase()).toBe('66');   // ~0.4
    expect(out.stroke!.slice(-2).toLowerCase()).toBe('33'); // ~0.2
  });

  it('clamps target to [0, 1]', () => {
    const out = computeScrubbedPaints(
      { fill: '#ff0000ff', stroke: '#00ff00ff' },
      1.5,
    );
    expect(out.fill!.slice(-2).toLowerCase()).toBe('ff');
    expect(out.stroke!.slice(-2).toLowerCase()).toBe('ff');
  });

  it('handles target = 0', () => {
    const out = computeScrubbedPaints(
      { fill: '#ff0000ff', stroke: '#00ff0080' },
      0,
    );
    expect(out.fill!.slice(-2).toLowerCase()).toBe('00');
    expect(out.stroke!.slice(-2).toLowerCase()).toBe('00');
  });

  it('passes through null paints unchanged', () => {
    const out = computeScrubbedPaints({ fill: null, stroke: '#000000ff' }, 0.5);
    expect(out.fill).toBeNull();
    expect(out.stroke!.slice(-2).toLowerCase()).toBe('80');
  });

  it('returns zero alphas unchanged when both start at 0 (no ratio to preserve)', () => {
    const out = computeScrubbedPaints(
      { fill: '#ff000000', stroke: '#00ff0000' },
      0.5,
    );
    expect(out.fill!.slice(-2).toLowerCase()).toBe('00');
    expect(out.stroke!.slice(-2).toLowerCase()).toBe('00');
  });

  it('skips non-hex string paints (gradients, named colors) by returning them unchanged', () => {
    const out = computeScrubbedPaints(
      { fill: 'url(#gradient)' as unknown as string, stroke: '#000000ff' },
      0.5,
    );
    expect(out.fill).toBe('url(#gradient)');
    expect(out.stroke!.slice(-2).toLowerCase()).toBe('80');
  });
});
