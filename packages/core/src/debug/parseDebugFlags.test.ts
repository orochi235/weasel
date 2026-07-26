import { describe, it, expect } from 'vitest';
import { parseDebugFlags } from './parseDebugFlags';

describe('parseDebugFlags', () => {
  it('returns null when no debug param', () => {
    expect(parseDebugFlags('')).toBeNull();
    expect(parseDebugFlags('?other=1')).toBeNull();
    expect(parseDebugFlags('?debug=')).toBeNull();
  });

  it('parses a single feature', () => {
    expect(parseDebugFlags('?debug=hitboxes')).toEqual({ hitboxes: true });
    expect(parseDebugFlags('?debug=bounds')).toEqual({ bounds: true });
  });

  it('parses comma-separated features', () => {
    expect(parseDebugFlags('?debug=bounds,origins')).toEqual({ bounds: true, origins: true });
  });

  it('"all" enables every feature', () => {
    expect(parseDebugFlags('?debug=all')).toEqual({
      hitboxes: true,
      handles: true,
      bounds: true,
      origins: true,
      snap: true,
      layers: true,
    });
  });

  it('ignores unknown feature keys but keeps known siblings', () => {
    expect(parseDebugFlags('?debug=bounds,nonsense,handles')).toEqual({
      bounds: true,
      handles: true,
    });
  });

  it('tolerates leading ? being absent', () => {
    expect(parseDebugFlags('debug=hitboxes')).toEqual({ hitboxes: true });
  });

  it('returns null when only unknown keys are present', () => {
    expect(parseDebugFlags('?debug=nonsense')).toBeNull();
  });
});
