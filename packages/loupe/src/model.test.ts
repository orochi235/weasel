import { describe, expect, it, vi } from 'vitest';
import { createLoupeModel, type LoupeSurface } from './model';

/** A surface that answers from plain fields, so a test can move the lens,
 *  hide it, or change what a point samples to between calls. */
function stubSurface(over: Partial<LoupeSurface> = {}) {
  const changed = vi.fn();
  const surface: LoupeSurface = {
    lens: () => ({ x: 0, y: 0, w: 100, h: 100 }),
    covers: () => false,
    sample: () => '#112233',
    hidden: () => false,
    gone: () => false,
    changed,
    ...over,
  };
  return { surface, changed };
}

describe('loupe model: aiming', () => {
  it('takes the aim and tells the surface something changed', () => {
    const { surface, changed } = stubSurface();
    const loupe = createLoupeModel({ surface });
    loupe.aimAt({ x: 30, y: 40 });
    expect(loupe.aim).toEqual({ x: 30, y: 40 });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('freezes while the lens covers the point, so its own edges stay reachable', () => {
    const { surface, changed } = stubSurface({ covers: (p) => p.x > 50 });
    const loupe = createLoupeModel({ surface });
    loupe.aimAt({ x: 10, y: 10 });
    loupe.aimAt({ x: 60, y: 10 });
    expect(loupe.aim).toEqual({ x: 10, y: 10 });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('ignores an aim while the lens is hidden', () => {
    const { surface, changed } = stubSurface({ hidden: () => true });
    const loupe = createLoupeModel({ surface });
    loupe.aimAt({ x: 10, y: 10 });
    expect(loupe.aim).toEqual({ x: 0, y: 0 });
    expect(changed).not.toHaveBeenCalled();
  });

  it('disposes itself when the surface reports the lens gone', () => {
    const onDispose = vi.fn();
    const { surface } = stubSurface({ gone: () => true });
    const loupe = createLoupeModel({ surface, onDispose });
    loupe.aimAt({ x: 10, y: 10 });
    expect(onDispose).toHaveBeenCalledTimes(1);
    expect(loupe.aim).toEqual({ x: 0, y: 0 });
  });

  it('goes quiet after dispose', () => {
    const { surface, changed } = stubSurface();
    const loupe = createLoupeModel({ surface });
    loupe.dispose();
    loupe.aimAt({ x: 10, y: 10 });
    loupe.setFactor(4);
    expect(changed).not.toHaveBeenCalled();
    expect(loupe.pick()).toBeNull();
  });
});

describe('loupe model: factor and mode', () => {
  it('defaults to vector at 8×', () => {
    const { surface } = stubSurface();
    const loupe = createLoupeModel({ surface });
    expect(loupe.mode).toBe('vector');
    expect(loupe.factor).toBe(8);
  });

  it('clamps the factor to the declared range', () => {
    const { surface } = stubSurface();
    const loupe = createLoupeModel({ surface, minFactor: 2, maxFactor: 16 });
    loupe.setFactor(64);
    expect(loupe.factor).toBe(16);
    loupe.setFactor(1);
    expect(loupe.factor).toBe(2);
  });

  it('leaves the factor alone when no range is declared', () => {
    const { surface } = stubSurface();
    const loupe = createLoupeModel({ surface });
    loupe.setFactor(1024);
    expect(loupe.factor).toBe(1024);
  });

  it('reports a mode change once, and not when it is already there', () => {
    const { surface, changed } = stubSurface();
    const loupe = createLoupeModel({ surface });
    loupe.setMode('pixel');
    loupe.setMode('pixel');
    expect(loupe.mode).toBe('pixel');
    expect(changed).toHaveBeenCalledTimes(1);
  });
});

describe('loupe model: colour', () => {
  it('reports the colour under a new aim, once per change', () => {
    const onColorChange = vi.fn();
    let hex = '#ff0000';
    const { surface } = stubSurface({ sample: () => hex });
    const loupe = createLoupeModel({ surface, onColorChange });
    loupe.aimAt({ x: 1, y: 1 });
    loupe.aimAt({ x: 2, y: 2 });
    expect(onColorChange).toHaveBeenCalledTimes(1);
    hex = '#00ff00';
    loupe.aimAt({ x: 3, y: 3 });
    expect(onColorChange).toHaveBeenLastCalledWith('#00ff00');
    expect(loupe.color).toBe('#00ff00');
  });

  it('keeps the last colour when the surface cannot answer', () => {
    let hex: string | null = '#abcdef';
    const { surface } = stubSurface({ sample: () => hex });
    const loupe = createLoupeModel({ surface });
    loupe.aimAt({ x: 1, y: 1 });
    hex = null;
    loupe.aimAt({ x: 2, y: 2 });
    expect(loupe.color).toBe('#abcdef');
  });
});

describe('loupe model: picking', () => {
  it('maps a lens point back through the magnification before sampling', () => {
    const seen: { x: number; y: number }[] = [];
    const { surface } = stubSurface({
      sample: (p) => { seen.push(p); return '#010203'; },
    });
    const loupe = createLoupeModel({ surface, factor: 4 });
    loupe.aimAt({ x: 200, y: 200 });
    seen.length = 0;
    // 20px right of the lens centre at 4× is 5px right of the aim point.
    expect(loupe.pick({ x: 70, y: 50 })).toBe('#010203');
    expect(seen).toEqual([{ x: 205, y: 200 }]);
  });

  it('picks at the aim point when given none', () => {
    const seen: { x: number; y: number }[] = [];
    const { surface } = stubSurface({
      sample: (p) => { seen.push(p); return '#010203'; },
    });
    const loupe = createLoupeModel({ surface });
    loupe.aimAt({ x: 12, y: 34 });
    seen.length = 0;
    loupe.pick();
    expect(seen).toEqual([{ x: 12, y: 34 }]);
  });

  it('refuses a pick whose source point is under the lens — that is chrome, not artwork', () => {
    const onPick = vi.fn();
    const { surface } = stubSurface({ covers: (p) => p.x > 190, sample: () => '#010203' });
    const loupe = createLoupeModel({ surface, factor: 4, onPick });
    loupe.aimAt({ x: 100, y: 100 });
    expect(loupe.pick({ x: 500, y: 50 })).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('leaves the aim and the reported colour alone', () => {
    const onColorChange = vi.fn();
    const { surface } = stubSurface({ sample: (p) => (p.x === 50 ? '#aaaaaa' : '#bbbbbb') });
    const loupe = createLoupeModel({ surface, onColorChange });
    loupe.aimAt({ x: 50, y: 50 });
    onColorChange.mockClear();
    loupe.pick({ x: 10, y: 10 });
    expect(loupe.aim).toEqual({ x: 50, y: 50 });
    expect(loupe.color).toBe('#aaaaaa');
    expect(onColorChange).not.toHaveBeenCalled();
  });

  it('reports the pick to the consumer and returns it', () => {
    const onPick = vi.fn();
    const { surface } = stubSurface({ sample: () => '#c0ffee' });
    const loupe = createLoupeModel({ surface, onPick });
    expect(loupe.pick()).toBe('#c0ffee');
    expect(onPick).toHaveBeenCalledWith('#c0ffee');
  });

  it('cannot pick without a lens to map through', () => {
    const onPick = vi.fn();
    const { surface } = stubSurface({ lens: () => null });
    const loupe = createLoupeModel({ surface, onPick });
    expect(loupe.pick({ x: 10, y: 10 })).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
  });
});
