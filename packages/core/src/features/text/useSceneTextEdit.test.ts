/**
 * `useSceneTextEdit`'s view projection. The rest of its surface (the six
 * scene callbacks) is covered through `useTextEdit.test.ts`; what is unique
 * here is the world→screen mapping, which is the only thing that separates
 * this helper from the raw hook on a canvas that pans or zooms.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
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
