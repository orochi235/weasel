import { describe, it, expect } from 'vitest';
import { findMountedCanvas, mountedCanvasRegistry, registerMountedCanvas, type MountedCanvas } from './mountedCanvases';

const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const canvasAt = (element: HTMLElement): MountedCanvas => ({ element, getView: () => view });

describe('mountedCanvasRegistry', () => {
  it('reflects each element, a later canvas on one element replacing the earlier, whose release then does nothing', () => {
    const el = document.createElement('div');
    document.body.append(el);
    const first = canvasAt(el);
    const second = canvasAt(el);
    const offFirst = registerMountedCanvas(first);
    const offSecond = registerMountedCanvas(second);
    try {
      const entry = mountedCanvasRegistry.entries().find((e) => e.key === el);
      expect(entry?.value).toBe(second);
      expect(entry?.shadowed).toEqual([]);
      offFirst();
      expect(findMountedCanvas(document.body)).toBe(second);
    } finally {
      offSecond();
      el.remove();
    }
    expect(mountedCanvasRegistry.has(el)).toBe(false);
  });
});
