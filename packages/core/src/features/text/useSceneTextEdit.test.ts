/**
 * `useSceneTextEdit`'s view projection. The rest of its surface (the six
 * scene callbacks) is covered through `useTextEdit.test.ts`; what is unique
 * here is the world→screen mapping, which is the only thing that separates
 * this helper from the raw hook on a canvas that pans or zooms.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { MouseEvent } from 'react';
import { useScene } from '../../core/scene/useScene';
import { asNodeId } from '../../core/scene/types';
import type { View } from '../../core/viewport/view';
import { useSceneTextEdit } from './useSceneTextEdit';

interface TextItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  style?: { fontSize?: number; fontWeight?: number };
}

const NODE: TextItem = {
  id: 'a',
  x: 100,
  y: 50,
  width: 200,
  height: 40,
  text: 'hello',
  style: { fontSize: 16 },
};

function renderEdit(view?: View) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const hook = renderHook(() => {
    const scene = useScene({ items: [NODE] });
    return useSceneTextEdit(scene, container, { view });
  });
  return { hook, container };
}

function overlayOf(container: HTMLElement): HTMLDivElement {
  return container.querySelector('div[contenteditable="true"]')!;
}

describe('useSceneTextEdit — view projection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('passes world units straight through when no view is supplied', () => {
    const { hook, container } = renderEdit();
    act(() => hook.result.current.startEdit('a'));
    const el = overlayOf(container);
    // +1 / -1 is the hook's CSS-vs-canvas rasterization nudge.
    expect(el.style.left).toBe('101px');
    expect(el.style.top).toBe('49px');
    expect(el.style.width).toBe('200px');
    expect(el.style.transform).toBe('none');
  });

  it('projects the origin through pan and zoom', () => {
    const { hook, container } = renderEdit({ x: 20, y: 10, scale: { x: 2, y: 2 } });
    act(() => hook.result.current.startEdit('a'));
    const el = overlayOf(container);
    // (100 - 20) * 2 = 160, (50 - 10) * 2 = 80, plus the nudge.
    expect(el.style.left).toBe('161px');
    expect(el.style.top).toBe('79px');
  });

  it('leaves the box and the font size in world units, scaled by the transform', () => {
    const { hook, container } = renderEdit({ x: 0, y: 0, scale: { x: 2, y: 2 } });
    act(() => hook.result.current.startEdit('a'));
    const el = overlayOf(container);
    expect(el.style.width).toBe('200px');
    expect(el.style.minHeight).toBe('40px');
    expect(el.style.fontSize).toBe('16px');
    expect(el.style.transform).toBe('scale(2)');
  });
});

/**
 * Clearing a flag the *node* sets is the one edit the additive run algebra
 * can't express, so `useTextEdit` declines it unless a `setStyle` writer
 * exists. The wrapper supplies one; without it every scene-wired consumer
 * silently refused the toggle.
 */
describe('useSceneTextEdit — setStyle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('un-bolding part of a bold node lowers the node flag and raises it on the rest', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const hook = renderHook(() => {
      const scene = useScene({
        items: [{
          id: 'a', x: 0, y: 0, width: 200, height: 40,
          text: 'abcd', style: { fontWeight: 700 }, runs: [{ text: 'abcd', bold: true }],
        }],
      });
      return { scene, edit: useSceneTextEdit(scene, container) };
    });

    act(() => hook.result.current.edit.startEdit('a'));
    const overlay = overlayOf(container);
    await act(async () => {
      const range = document.createRange();
      const text = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT).nextNode() as Text;
      range.setStart(text, 0);
      range.setEnd(text, 2);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      overlay.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'b', metaKey: true, bubbles: true, cancelable: true,
      }));
    });

    const style = hook.result.current.scene.get(asNodeId('a'))?.data.style;
    expect(style?.fontWeight).toBe(400);
    act(() => hook.result.current.edit.commit());
    const runs = hook.result.current.scene.get(asNodeId('a'))?.data.runs;
    expect(runs).toEqual([{ text: 'ab' }, { text: 'cd', bold: true }]);
  });
});

/**
 * A `view` thunk is the uncontrolled-canvas path: the camera lives in a ref
 * and moves without a React render, so a `View` captured at render time
 * would freeze the overlay while the canvas pans under it.
 */
describe('useSceneTextEdit — view thunk', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function renderThunkEdit(read: () => View) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const hook = renderHook(() => {
      const scene = useScene({ items: [NODE] });
      return useSceneTextEdit(scene, container, { view: read });
    });
    return { hook, container };
  }

  it('re-reads the thunk on every projection, so the overlay tracks a moving camera', () => {
    let live: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const frames: FrameRequestCallback[] = [];
    const realRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    }) as typeof globalThis.requestAnimationFrame;
    try {
      const { hook, container } = renderThunkEdit(() => live);
      act(() => hook.result.current.startEdit('a'));
      const el = overlayOf(container);
      // (100 - 0) * 1 + the hook's +1 / -1 rasterization nudge.
      expect(el.style.left).toBe('101px');
      expect(el.style.top).toBe('49px');

      live = { x: 40, y: 10, scale: { x: 1, y: 1 } };
      act(() => { frames[frames.length - 1]!(0); });
      expect(el.style.left).toBe('61px');
      expect(el.style.top).toBe('39px');

      live = { x: 90, y: 45, scale: { x: 2, y: 2 } };
      act(() => { frames[frames.length - 1]!(0); });
      expect(el.style.left).toBe('21px');
      expect(el.style.top).toBe('9px');
      expect(el.style.transform).toBe('scale(2)');
    } finally {
      globalThis.requestAnimationFrame = realRaf;
    }
  });

  it('un-projects a double-click through the thunk read at click time', () => {
    let live: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const { hook, container } = renderThunkEdit(() => live);
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    // The node's world box is x 100..300, y 50..90. jsdom reports a zeroed
    // client rect, so a click at (10, 10) is canvas-space (10, 10) — inside
    // the node only once the camera has panned to (100, 50).
    live = { x: 100, y: 50, scale: { x: 1, y: 1 } };
    act(() => hook.result.current.onDoubleClick({
      target: canvas, clientX: 10, clientY: 10,
    } as unknown as MouseEvent<HTMLElement>));
    expect(hook.result.current.editingId).toBe('a');
  });
});
