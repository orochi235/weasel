import { describe, expect, it, vi } from 'vitest';
import type { CameraView } from './CameraInput';
import { createCameraRegistry } from './cameraRegistry';

const camera = (): CameraView => ({
  get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }),
  set: () => {},
  zoomRange: () => ({ min: 0.1, max: 32 }),
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
