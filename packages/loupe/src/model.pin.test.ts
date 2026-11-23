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
});
