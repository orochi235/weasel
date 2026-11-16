import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetPaintDrawKindsForTests, getPaintDrawKind, isPaintKindKnown, registerPaintDrawKindLoader, type PaintDrawKind } from './paintKinds';

afterEach(() => _resetPaintDrawKindsForTests());

const never = () => new Promise<PaintDrawKind>(() => {});

describe('registerPaintDrawKindLoader', () => {
  it('uncovers the older loader when the newer one is disposed', () => {
    const older = vi.fn(never);
    registerPaintDrawKindLoader('stacked', older);
    const off = registerPaintDrawKindLoader('stacked', vi.fn(never));
    off();
    getPaintDrawKind('stacked');
    expect(older).toHaveBeenCalledTimes(1);
  });

  it('removes only a buried loader when it is disposed', () => {
    const off = registerPaintDrawKindLoader('stacked', vi.fn(never));
    const newer = vi.fn(never);
    registerPaintDrawKindLoader('stacked', newer);
    off();
    expect(isPaintKindKnown('stacked')).toBe(true);
    getPaintDrawKind('stacked');
    expect(newer).toHaveBeenCalledTimes(1);
  });
});
