import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { CameraView } from './CameraInput';
import { createCameraRegistry } from './cameraRegistry';

const camera = (): CameraView => ({
  get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }),
  set: () => {},
  zoomRange: () => ({ min: 0.1, max: 32 }),
  zoomOf: () => 1,
});

describe('createCameraRegistry', () => {
  it('answers null for a key nothing registered', () => {
    expect(createCameraRegistry().get('a')).toBeNull();
  });

  it('holds a camera until its release', () => {
    const reg = createCameraRegistry();
    const cam = camera();
    const off = reg.register('a', cam);
    expect(reg.get('a')).toBe(cam);
    off();
    expect(reg.get('a')).toBeNull();
  });

  it('keeps the newest of a key live, and a release uncovers the one it displaced', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const reg = createCameraRegistry();
    const first = camera();
    const second = camera();
    const offFirst = reg.register('a', first);
    const offSecond = reg.register('a', second);
    expect(reg.get('a')).toBe(second);
    offFirst();
    expect(reg.get('a')).toBe(second);
    offSecond();
    expect(reg.get('a')).toBeNull();
    reg.register('a', first);
    const offAgain = reg.register('a', second);
    offAgain();
    expect(reg.get('a')).toBe(first);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('reflects each key, reporting the camera a newer one covers', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const reg = createCameraRegistry();
    const first = camera();
    const second = camera();
    reg.register('a', first);
    reg.register('a', second);
    expect(
      reg.reflection.entries().map((e) => [e.key, e.value, e.shadowed.map((s) => s.value)]),
    ).toEqual([['a', second, [first]]]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('a release takes out its own registration when one camera is registered twice under a key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const reg = createCameraRegistry();
    const cam = camera();
    const other = camera();
    const offFirst = reg.register('a', cam);
    reg.register('a', other);
    reg.register('a', cam);
    offFirst();
    expect(reg.get('a')).toBe(cam);
    expect(reg.reflection.entries().map((e) => e.shadowed.map((s) => s.value))).toEqual([[other]]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('tells subscribers when a key changes hands, and stops when they leave', () => {
    const reg = createCameraRegistry();
    const listener = vi.fn();
    const unsubscribe = reg.subscribe(listener);
    const off = reg.register('a', camera());
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    off();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    reg.register('b', camera());
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
