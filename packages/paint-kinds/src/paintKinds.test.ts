import { describe, it, expect, afterEach, vi } from 'vitest';
import type { GradientPaint, Paint } from '@weasel-js/paint';
import { registerPaintDrawKind, warmPaintKinds } from '@weasel-js/renderer';
import { getPaintKind, registerPaintKind, registerPaintKindLoader, withPaintKind } from './paintKinds';
import type { PaintKindEntry } from './paintKindEntry';
import { _resetPaintKindsForTests } from './test-seams';

afterEach(() => _resetPaintKindsForTests());

const washEntry = (extra: Partial<PaintKindEntry> = {}): PaintKindEntry => ({
  id: 'test-wash',
  label: 'Wash',
  seed: (color) => ({ kind: 'test-wash', color } as unknown as Paint),
  colorOf: () => undefined,
  ...extra,
});

describe('gradient seeds', () => {
  it.each(['#ffffff', '#fff', '#FFF', 'white', 'rgb(255, 255, 255)'])('ramps %s to black', (white) => {
    const seeded = getPaintKind('linear-gradient')!.seed(white) as GradientPaint;
    expect(seeded.stops[1].color).toBe('#000000ff');
  });

  it('ramps any other color to white', () => {
    const seeded = getPaintKind('linear-gradient')!.seed('#fffffe') as GradientPaint;
    expect(seeded.stops[1].color).toBe('#ffffffff');
  });
});

describe('a gradient kind\'s color', () => {
  it('is the color at the start, whatever order the stops are listed in', () => {
    const paint = {
      kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: [{ offset: 1, color: '#ff0000ff' }, { offset: 0, color: '#0000ffff' }],
    } as Paint;
    expect(getPaintKind('linear-gradient')!.colorOf(paint)).toBe('#0000ffff');
  });
});

describe('withPaintKind', () => {
  it('builds through an override of a built-in gradient kind', () => {
    const radial = getPaintKind('radial-gradient')!;
    const fromStops = vi.fn(radial.fromStops!);
    registerPaintKind({ ...radial, fromStops });
    const linear = getPaintKind('linear-gradient')!.seed('#ff0000ff');
    withPaintKind(linear, 'radial-gradient');
    expect(fromStops).toHaveBeenCalled();
  });
});

describe('a paint kind loaded on demand', () => {
  it('logs an entry that fails registration', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    registerPaintKindLoader('test-wash', async () => washEntry({ stopsOf: () => [] }));
    await expect(warmPaintKinds(['test-wash'])).rejects.toThrow(/missing fromStops/);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('test-wash'), expect.any(Error));
    error.mockRestore();
  });

  it('loads its editor half when only its draw half was registered elsewhere', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerPaintDrawKind({ id: 'test-wash' });
    const load = vi.fn(async () => washEntry());
    registerPaintKindLoader('test-wash', load);
    expect(getPaintKind('test-wash')).toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);
    await warmPaintKinds(['test-wash']);
    expect(getPaintKind('test-wash')?.label).toBe('Wash');
    warn.mockRestore();
  });
});
