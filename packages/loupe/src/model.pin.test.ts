import { describe, expect, it, vi } from 'vitest';
import { createLoupeModel, type LoupeSurface } from './model';

/** A surface over content seen through a camera a test can pan: content x is surface x plus `pan`. */
function pannedSurface(over: Partial<LoupeSurface> = {}) {
  const camera = { pan: 0 };
  const surface: LoupeSurface = {
    lens: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    covers: () => false,
    sample: (p) => `#${String(Math.round(p.x)).padStart(6, '0')}`,
    hidden: () => false,
    gone: () => false,
    changed: vi.fn(),
    worldAt: (p) => ({ x: p.x + camera.pan, y: p.y }),
    pointFor: (w) => ({ x: w.x - camera.pan, y: w.y }),
    ...over,
  };
  return { surface, camera };
}

describe('loupe model: a pinned aim', () => {
  it('pins the content under the aim, and stays on it as the camera pans', () => {
    const { surface, camera } = pannedSurface();
    const loupe = createLoupeModel({ surface });
    loupe.aimAt({ x: 30, y: 40 });
    loupe.setAimMode('pinned');
    camera.pan = 10;
    expect(loupe.aimMode).toBe('pinned');
    expect(loupe.aim).toEqual({ x: 20, y: 40 });
  });

  it('ignores aims while pinned, and follows them again once let go, from where the pin stood', () => {
    const { surface, camera } = pannedSurface();
    const loupe = createLoupeModel({ surface });
    loupe.aimAt({ x: 30, y: 40 });
    loupe.setAimMode('pinned');
    loupe.aimAt({ x: 90, y: 90 });
    expect(loupe.aim).toEqual({ x: 30, y: 40 });
    camera.pan = 10;
    loupe.setAimMode('follow');
    expect(loupe.aim).toEqual({ x: 20, y: 40 });
    loupe.aimAt({ x: 90, y: 90 });
    expect(loupe.aim).toEqual({ x: 90, y: 90 });
  });

  it('moves the pin to a point, pinning a following aim, and samples there', () => {
    const onColorChange = vi.fn();
    const { surface } = pannedSurface();
    const loupe = createLoupeModel({ surface, onColorChange });
    loupe.pinAt({ x: 55, y: 5 });
    expect(loupe.aimMode).toBe('pinned');
    expect(loupe.aim).toEqual({ x: 55, y: 5 });
    expect(onColorChange).toHaveBeenLastCalledWith('#000055');
  });

  it('refuses a pin where the lens covers the point', () => {
    const { surface } = pannedSurface({ covers: (p) => p.x > 50 });
    const loupe = createLoupeModel({ surface });
    loupe.pinAt({ x: 60, y: 5 });
    expect(loupe.aimMode).toBe('follow');
  });

  it('samples where the pin stands now, after the camera moved', () => {
    const { surface, camera } = pannedSurface();
    const loupe = createLoupeModel({ surface });
    loupe.pinAt({ x: 30, y: 0 });
    camera.pan = 10;
    loupe.resample();
    expect(loupe.color).toBe('#000020');
    expect(loupe.pick()).toBe('#000020');
  });

  it('holds its surface point on a surface that cannot say where content is', () => {
    const { surface, camera } = pannedSurface({ worldAt: undefined, pointFor: undefined });
    const loupe = createLoupeModel({ surface, aimMode: 'pinned' });
    loupe.pinAt({ x: 30, y: 40 });
    camera.pan = 10;
    expect(loupe.aim).toEqual({ x: 30, y: 40 });
  });

  it('puts a pin back on the content it held, wherever the camera has moved it to', () => {
    const { surface, camera } = pannedSurface();
    const loupe = createLoupeModel({ surface });
    loupe.pinAt({ x: 30, y: 40 });
    const held = loupe.pin;
    expect(held).toEqual({ x: 30, y: 40 });
    loupe.pinAt({ x: 70, y: 70 });
    camera.pan = 10;
    loupe.holdPin(held!);
    expect(loupe.aim).toEqual({ x: 20, y: 40 });
    loupe.setAimMode('follow');
    expect(loupe.pin).toBeNull();
  });

  it.each(['worldAt', 'pointFor'] as const)('refuses a surface that implements %s without its inverse', (only) => {
    const { surface } = pannedSurface({ [only === 'worldAt' ? 'pointFor' : 'worldAt']: undefined });
    expect(() => createLoupeModel({ surface })).toThrow(TypeError);
  });

  it('tears down on an aim while pinned once the surface is gone', () => {
    const onDispose = vi.fn();
    let gone = false;
    const { surface } = pannedSurface({ gone: () => gone });
    const loupe = createLoupeModel({ surface, aimMode: 'pinned', onDispose });
    gone = true;
    loupe.aimAt({ x: 5, y: 5 });
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it('copies the points it is aimed and pinned at, so a reused point object moves nothing', () => {
    const loupe = createLoupeModel({ surface: pannedSurface({ worldAt: undefined, pointFor: undefined }).surface });
    const scratch = { x: 10, y: 20 };
    loupe.aimAt(scratch);
    scratch.x = 99;
    expect(loupe.aim).toEqual({ x: 10, y: 20 });
    loupe.holdPin(scratch);
    scratch.x = 1;
    expect(loupe.pin).toEqual({ x: 99, y: 20 });
    loupe.pinAt(scratch);
    scratch.x = 2;
    expect(loupe.aim).toEqual({ x: 1, y: 20 });
    loupe.aim.x = 3;
    loupe.pin!.x = 3;
    expect(loupe.aim).toEqual({ x: 1, y: 20 });
  });

  it('picks nothing at a pin the camera has panned under a stationary lens', () => {
    const onPick = vi.fn();
    const { surface, camera } = pannedSurface({ covers: (p) => p.x > 50 });
    const loupe = createLoupeModel({ surface, onPick });
    loupe.pinAt({ x: 40, y: 5 });
    camera.pan = -20;
    expect(loupe.pick()).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('holds a pin put back under the lens or while hidden, without sampling the lens for it', () => {
    const onColorChange = vi.fn();
    let hidden = false;
    const { surface } = pannedSurface({ covers: (p) => p.x > 50, hidden: () => hidden });
    const loupe = createLoupeModel({ surface, onColorChange });
    loupe.holdPin({ x: 60, y: 5 });
    expect(loupe.pin).toEqual({ x: 60, y: 5 });
    hidden = true;
    loupe.holdPin({ x: 10, y: 5 });
    expect(loupe.pin).toEqual({ x: 10, y: 5 });
    expect(onColorChange).not.toHaveBeenCalled();
    hidden = false;
    loupe.resample();
    expect(onColorChange).toHaveBeenLastCalledWith('#000010');
  });

  it('samples a pin on a landed frame only once it is out from under the lens', () => {
    const onColorChange = vi.fn();
    const frames: (() => void)[] = [];
    const { surface, camera } = pannedSurface({
      covers: (p) => p.x > 50,
      subscribeFrame: (fn) => { frames.push(fn); return () => undefined; },
    });
    const loupe = createLoupeModel({ surface, onColorChange });
    loupe.pinAt({ x: 40, y: 5 });
    camera.pan = -20;
    frames.forEach((fn) => fn());
    loupe.resample();
    expect(onColorChange).not.toHaveBeenCalled();
    camera.pan = 0;
    frames.forEach((fn) => fn());
    expect(onColorChange).toHaveBeenLastCalledWith('#000040');
  });
});
