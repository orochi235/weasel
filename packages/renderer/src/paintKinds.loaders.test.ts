import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _resetPaintDrawKindsForTests, getPaintDrawKind, isPaintKindKnown, registerPaintDrawKindLoader, warmPaintKinds,
  type PaintDrawKind,
} from './paintKinds';

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

  it('calls a loader declared over one whose load failed', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    registerPaintDrawKindLoader('retry', () => Promise.reject(new Error('offline')));
    await expect(warmPaintKinds(['retry'])).rejects.toThrow('offline');
    const kind = { id: 'retry' } as PaintDrawKind;
    const newer = vi.fn(() => Promise.resolve(kind));
    registerPaintDrawKindLoader('retry', newer);
    await warmPaintKinds(['retry']);
    expect(newer).toHaveBeenCalledTimes(1);
    expect(getPaintDrawKind('retry')).toBe(kind);
    error.mockRestore();
  });

  it('registers nothing from a load its loader was displaced during, and answers with the new one', async () => {
    let finish!: (kind: PaintDrawKind) => void;
    registerPaintDrawKindLoader('slow', () => new Promise<PaintDrawKind>((r) => { finish = r; }));
    const warming = warmPaintKinds(['slow']);
    const kind = { id: 'slow' } as PaintDrawKind;
    registerPaintDrawKindLoader('slow', () => Promise.resolve(kind));
    finish({ id: 'slow' } as PaintDrawKind);
    await warming;
    expect(getPaintDrawKind('slow')).toBe(kind);
  });

  it('removes the kind a loader registered when the loader is disposed', async () => {
    const off = registerPaintDrawKindLoader('owned', () => Promise.resolve({ id: 'owned' } as PaintDrawKind));
    await warmPaintKinds(['owned']);
    expect(getPaintDrawKind('owned')).toBeDefined();
    off();
    expect(getPaintDrawKind('owned')).toBeUndefined();
    expect(isPaintKindKnown('owned')).toBe(false);
  });

  it('registers nothing from a load that finishes after its loader was disposed', async () => {
    let finish!: (kind: PaintDrawKind) => void;
    const off = registerPaintDrawKindLoader('gone', () => new Promise<PaintDrawKind>((r) => { finish = r; }));
    const warming = warmPaintKinds(['gone']);
    off();
    finish({ id: 'gone' } as PaintDrawKind);
    await warming;
    expect(getPaintDrawKind('gone')).toBeUndefined();
  });
});
