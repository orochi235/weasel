import { describe, expect, it, vi } from 'vitest';
import { createEyedropperModel } from './eyedropper';
import { createLoupeModel, type LoupeSurface } from './model';

const at = (x: number, y: number) => ({ x, y });
const red = () => '#ff0000';

function surface(sample: (p: { x: number; y: number }) => string | null): LoupeSurface {
  return {
    lens: () => ({ x: 0, y: 0, w: 100, h: 100 }),
    covers: () => false,
    sample,
    hidden: () => false,
    gone: () => false,
    changed: () => undefined,
  };
}

describe('eyedropper model', () => {
  it('hover samples the point and reports a change once', () => {
    const onColorChange = vi.fn();
    const drop = createEyedropperModel({ sample: red, onColorChange });
    drop.hover(at(1, 2));
    drop.hover(at(3, 4));
    expect(drop.color).toBe('#ff0000');
    expect(onColorChange).toHaveBeenCalledTimes(1);
    drop.leave();
    expect(drop.color).toBeNull();
    expect(onColorChange).toHaveBeenLastCalledWith(null);
  });

  it('hover aims a loupe on the same surface, whose readout is the color a click takes', () => {
    const sample = (p: { x: number; y: number }) => (p.x < 50 ? '#111111' : '#222222');
    const loupe = createLoupeModel({ surface: surface(sample) });
    const onPick = vi.fn();
    const drop = createEyedropperModel({ sample, loupe, onPick });
    drop.hover(at(70, 10));
    expect(loupe.aim).toEqual(at(70, 10));
    expect(loupe.color).toBe(drop.color);
    expect(drop.pick(at(70, 10))).toBe(loupe.color);
    expect(onPick).toHaveBeenCalledWith('#222222');
  });

  it('pick reports a color and nothing where nothing is drawn', () => {
    const onPick = vi.fn();
    const drop = createEyedropperModel({ sample: (p) => (p.x > 0 ? '#abcdef' : null), onPick });
    expect(drop.pick(at(0, 0))).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
    expect(drop.pick(at(5, 0))).toBe('#abcdef');
    expect(onPick).toHaveBeenCalledWith('#abcdef');
  });

  it('takes an async sampler, and drops a hover a later one overtook', async () => {
    const pending: Array<(hex: string) => void> = [];
    const sample = () => new Promise<string>((resolve) => pending.push(resolve));
    const onPick = vi.fn();
    const drop = createEyedropperModel({ sample, onPick });
    drop.hover(at(1, 1));
    drop.hover(at(2, 2));
    pending[1]('#000002');
    pending[0]('#000001');
    await Promise.resolve();
    await Promise.resolve();
    expect(drop.color).toBe('#000002');

    const picked = drop.pick(at(3, 3));
    pending[2]('#000003');
    await expect(picked).resolves.toBe('#000003');
    expect(onPick).toHaveBeenCalledWith('#000003');
  });

  it('does nothing once disposed', () => {
    const onPick = vi.fn();
    const drop = createEyedropperModel({ sample: red, onPick });
    drop.dispose();
    drop.hover(at(1, 1));
    expect(drop.pick(at(1, 1))).toBeNull();
    expect(drop.color).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
  });
});
