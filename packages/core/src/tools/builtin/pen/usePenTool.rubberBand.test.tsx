import { describe, it, expect, vi } from 'vitest';
import { act } from '@testing-library/react';
import { createPointerStore } from '@weasel-js/routing/react';
import { gridSource } from 'features/snap/testing/sessionDep';
import { setup } from './testing/penHarness';

// The real layer, recorded: the pen keeps its state to itself, and the one
// place it hands that object out is to the preview layer that paints from it.
vi.mock('features/paths/penPreviewLayer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('features/paths/penPreviewLayer')>();
  return { ...actual, createPenPreviewLayer: vi.fn(actual.createPenPreviewLayer) };
});

describe('usePenTool', () => {
  describe('rubber band and close hint', () => {
    const at = (x: number, y: number) => ({ worldX: x, worldY: y, viewId: null });

    it('trails the pointer once an anchor is placed, through the snap dep', () => {
      const pointer = createPointerStore();
      const p = setup({ deps: { pointer }, snap: [gridSource(10)] });
      act(() => { pointer.set(at(33, 80)); });
      expect(p.scratch.cursor).toBeNull();
      p.click(0, 0);
      act(() => { pointer.set(at(52, 80)); });
      expect(p.scratch.cursor).toEqual({ x: 50, y: 80 });
      act(() => { pointer.set(null); });
      expect(p.scratch.cursor).toBeNull();
    });

    it('hints the close while the pointer is on the first anchor of three or more', () => {
      const pointer = createPointerStore();
      const p = setup({ deps: { pointer }, closeHitRadius: 8 });
      const cursor = p.tool.cursor as () => string;
      p.click(0, 0); p.click(100, 0);
      act(() => { pointer.set(at(2, 2)); });
      expect(p.scratch.closeHintActive).toBe(false);
      p.click(100, 100);
      act(() => { pointer.set(at(3, 3)); });
      expect(p.scratch.closeHintActive).toBe(true);
      expect(cursor()).toBe('pointer');
      act(() => { pointer.set(at(40, 40)); });
      expect(p.scratch.closeHintActive).toBe(false);
    });

    it('stops trailing once the path is finished or discarded', () => {
      const pointer = createPointerStore();
      const p = setup({ deps: { pointer } });
      p.click(0, 0); p.click(100, 0);
      p.escape();
      act(() => { pointer.set(at(10, 10)); });
      expect(p.scratch.cursor).toBeNull();
      p.click(0, 0);
      p.deactivate();
      act(() => { pointer.set(at(20, 20)); });
      expect(p.scratch.cursor).toBeNull();
    });
  });
});
