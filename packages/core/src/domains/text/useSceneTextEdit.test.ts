/**
 * `useSceneTextEdit`'s view projection. The rest of its surface (the six
 * scene callbacks) is covered through `useTextEdit.test.ts`; what is unique
 * here is the world→screen mapping, which is the only thing that separates
 * this helper from the raw hook on a canvas that pans or zooms.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { act, render, renderHook } from '@testing-library/react';
import { Suspense, createElement, startTransition, useState } from 'react';
import { Hang } from '@weasel-js/react/testing/abandonRender';
import { useScene } from '../../core/scene/useScene';
import { asNodeId } from '../../core/scene/types';
import type { View } from '../../core/viewport/view';
import { registerMountedCanvas } from '../../canvas/mountedCanvases';
import { useSceneTextEdit } from './useSceneTextEdit';
import { openAt } from './testing/openAt';

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
    expect(el.style.left).toBe('100px');
    expect(el.style.top).toBe('50px');
    expect(el.style.minWidth).toBe('200px');
    expect(el.style.transform).toBe('none');
  });

  it('projects the origin through pan and zoom', () => {
    const { hook, container } = renderEdit({ x: 20, y: 10, scale: { x: 2, y: 2 } });
    act(() => hook.result.current.startEdit('a'));
    const el = overlayOf(container);
    // (100 - 20) * 2 = 160, (50 - 10) * 2 = 80.
    expect(el.style.left).toBe('160px');
    expect(el.style.top).toBe('80px');
  });

  it('leaves the box and the font size in world units, scaled by the transform', () => {
    const { hook, container } = renderEdit({ x: 0, y: 0, scale: { x: 2, y: 2 } });
    act(() => hook.result.current.startEdit('a'));
    const el = overlayOf(container);
    expect(el.style.minWidth).toBe('200px');
    expect(el.style.minHeight).toBe('40px');
    expect(el.style.fontSize).toBe('16px');
    expect(el.style.transform).toBe('scale(2)');
  });

  it("carries the node's verticalAlign onto the overlay's pose", () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const hook = renderHook(() => {
      const scene = useScene({ items: [{ ...NODE, verticalAlign: 'bottom' as const }] });
      return useSceneTextEdit(scene, container);
    });
    act(() => hook.result.current.startEdit('a'));
    const el = overlayOf(container);
    // jsdom measures the content as 0 tall, so the whole 40px box is slack.
    expect(el.style.minHeight).toBe('');
    expect(el.style.top).toBe('90px');
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

  it('un-bolding part of a bold node writes a regular weight over that part alone', async () => {
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
    expect(style?.fontWeight).toBe(700);
    act(() => hook.result.current.edit.commitEdit());
    const runs = hook.result.current.scene.get(asNodeId('a'))?.data.runs;
    expect(runs).toEqual([{ text: 'ab', fontWeight: 400 }, { text: 'cd', bold: true }]);
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
      expect(el.style.left).toBe('100px');
      expect(el.style.top).toBe('50px');

      live = { x: 40, y: 10, scale: { x: 1, y: 1 } };
      act(() => { frames[frames.length - 1]!(0); });
      expect(el.style.left).toBe('60px');
      expect(el.style.top).toBe('40px');

      live = { x: 90, y: 45, scale: { x: 2, y: 2 } };
      act(() => { frames[frames.length - 1]!(0); });
      expect(el.style.left).toBe('20px');
      expect(el.style.top).toBe('10px');
      expect(el.style.transform).toBe('scale(2)');
    } finally {
      globalThis.requestAnimationFrame = realRaf;
    }
  });

  it('does not open the editor on a node whose layer is locked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const hook = renderHook(() => {
      const scene = useScene({ items: [NODE] });
      return { scene, edit: useSceneTextEdit(scene, container) };
    });
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    const { scene } = hook.result.current;
    act(() => scene.setLayerLocked(scene.layers[0]!.id, true));
    act(() => openAt(hook.result.current.edit, 110, 60));
    expect(hook.result.current.edit.editingId).toBeNull();

    act(() => scene.setLayerLocked(scene.layers[0]!.id, false));
    act(() => openAt(hook.result.current.edit, 110, 60));
    expect(hook.result.current.edit.editingId).toBe('a');
  });
});

describe('useSceneTextEdit — a double-click on a node that is not text', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  type Item = Omit<TextItem, 'text'> & { text?: string; label?: string };
  const BOX: Item = { id: 'box', x: 100, y: 50, width: 200, height: 40 };

  function mount(items: Item[], isText?: (data: Item) => boolean) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    const hook = renderHook(() => {
      const scene = useScene({ items });
      return useSceneTextEdit(scene, container, { isText });
    });
    const dblclick = () => act(() => openAt(hook.result.current, 110, 60));
    return { hook, dblclick };
  }

  it('opens no editor on it', () => {
    const { hook, dblclick } = mount([BOX]);
    dblclick();
    expect(hook.result.current.editingId).toBeNull();
  });

  it('opens the text node under it', () => {
    const { hook, dblclick } = mount([NODE, BOX]);
    dblclick();
    expect(hook.result.current.editingId).toBe('a');
  });

  it('asks the isText option when one is passed', () => {
    const { hook, dblclick } = mount(
      [NODE, { ...BOX, label: 'x' }],
      (data) => data.label !== undefined,
    );
    dblclick();
    expect(hook.result.current.editingId).toBe('box');
  });

  it('answers isTextNode by id with the same predicate', () => {
    const { hook } = mount([NODE, BOX]);
    expect(hook.result.current.isTextNode('a')).toBe(true);
    expect(hook.result.current.isTextNode('box')).toBe(false);
    expect(hook.result.current.isTextNode('gone')).toBe(false);
  });
});

/**
 * With no `view` passed, the camera comes from the kit canvas mounted inside
 * the container — the consumer should not have to thread it through.
 */
describe('useSceneTextEdit — the canvas inside the container', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function setRect(el: Element, x: number, y: number, width: number, height: number) {
    el.getBoundingClientRect = () => ({
      x, y, left: x, top: y, width, height, right: x + width, bottom: y + height,
      toJSON: () => ({}),
    }) as DOMRect;
  }

  function mount() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    const hook = renderHook(() => {
      const scene = useScene({ items: [NODE] });
      return useSceneTextEdit(scene, container);
    });
    return { hook, container, canvas };
  }

  it('reads the view from that canvas', () => {
    const { hook, container, canvas } = mount();
    const dispose = registerMountedCanvas({
      element: canvas,
      getView: () => ({ x: 20, y: 10, scale: { x: 2, y: 2 } }),
    });
    try {
      act(() => hook.result.current.startEdit('a'));
      const el = overlayOf(container);
      // (100 - 20) * 2 = 160, (50 - 10) * 2 = 80.
      expect(el.style.left).toBe('160px');
      expect(el.style.top).toBe('80px');
      expect(el.style.transform).toBe('scale(2)');
    } finally {
      dispose();
    }
  });

  it('projects from the canvas origin and clips the overlay to the canvas box', () => {
    const { hook, container, canvas } = mount();
    setRect(container, 100, 50, 800, 600);
    setRect(canvas, 140, 80, 600, 400);
    const dispose = registerMountedCanvas({
      element: canvas,
      getView: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }),
    });
    try {
      act(() => hook.result.current.startEdit('a'));
      const el = overlayOf(container);
      const clip = el.parentElement!.parentElement!;
      expect(clip).not.toBe(container);
      expect(clip.style.overflow).toBe('clip');
      expect([clip.style.left, clip.style.top, clip.style.width, clip.style.height])
        .toEqual(['40px', '30px', '600px', '400px']);
      // World (100, 50) is canvas (100, 50), container (140, 80), clip box
      // (100, 50).
      expect(el.style.left).toBe('100px');
      expect(el.style.top).toBe('50px');
    } finally {
      dispose();
    }
  });
});

/**
 * A derived pose is where the node actually is; its authored pose is a
 * placeholder. Both the double-click hit test and the overlay's own
 * projection have to answer from the derivation, or the editor opens on the
 * wrong node and then sits somewhere the text is not.
 */
describe('useSceneTextEdit — a derived pose', () => {
  interface Data { text?: string; style?: { fontSize?: number } }
  interface Pose { x: number; y: number; width: number; height: number }

  /** Places the node 300 right of its dependency. */
  const derive = (_n: unknown, deps: readonly ({ pose: Pose } | undefined)[]): Pose | null => {
    const d = deps[0]?.pose;
    return d === undefined ? null : { x: d.x + 300, y: d.y, width: 200, height: 40 };
  };

  function renderDerived() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const hook = renderHook(() => {
      const scene = useScene<Data, 'main', Pose>({
        systemLayers: [{ id: 'main' }],
        registry: { derivePose: { 'test:shift': derive } },
        initial: [
          {
            id: asNodeId('anchor'), kind: 'mark', layer: 'main',
            pose: { x: 0, y: 0, width: 10, height: 10 }, data: {},
          },
          {
            id: asNodeId('label'), kind: 'mark', layer: 'main',
            pose: { x: 0, y: 0, width: 200, height: 40 },
            data: { text: 'hello', style: { fontSize: 16 } },
            dependsOn: [asNodeId('anchor')], derivePose: derive,
          },
        ],
      });
      return useSceneTextEdit(scene, container, {});
    });
    return { hook, container };
  }

  it('hit-tests a double-click against the derived pose', () => {
    const { hook, container } = renderDerived();
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    // x 300..500 once derived; the authored pose claims x 0..200.
    act(() => openAt(hook.result.current, 320, 10));
    expect(hook.result.current.editingId).toBe('label');
  });

  it('does not hit-test against the authored placeholder', () => {
    const { hook, container } = renderDerived();
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    act(() => openAt(hook.result.current, 20, 10));
    expect(hook.result.current.editingId).toBeNull();
  });

  it('places the overlay at the derived pose', () => {
    const { hook, container } = renderDerived();
    act(() => hook.result.current.startEdit('label'));
    expect(overlayOf(container).style.left).toBe('300px');
  });
});

/**
 * The overlay and the double-click answer for the lines the canvas drew.
 * `'AB AB AB'` at the fixture's size is 148 units, three times the 50-unit box.
 */
describe('useSceneTextEdit — a line longer than its box', () => {
  const SIZE = 32;
  const LINE = SIZE * 1.2;
  interface LongItem {
    id: string; x: number; y: number; width: number; height: number; text: string;
    runs: { text: string }[];
    style: { fontFamily: string; fontSize: number; wrap?: boolean; align?: 'left' | 'center' | 'right' };
    verticalAlign?: 'top' | 'center' | 'bottom';
  }
  const long = (style: Partial<LongItem['style']> = {}): LongItem => ({
    id: 'a', x: 100, y: 50, width: 50, height: 200, text: 'AB AB AB',
    runs: [{ text: 'AB AB AB' }],
    style: { fontFamily: 'inter', fontSize: SIZE, ...style },
  });

  beforeEach(async () => {
    document.body.innerHTML = '';
    _resetFontRegistryForTests();
    _resetLayoutCacheForTests();
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => (
      url.endsWith('.json')
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
        : Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
        })
    )) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
    await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');
    _resetLayoutCacheForTests();
  });

  function mount(item: LongItem) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const hook = renderHook(() => {
      const scene = useScene({ items: [item] });
      return useSceneTextEdit(scene, container);
    });
    return { hook, container };
  }

  it('keeps an unwrapped line on one line in the overlay', () => {
    const { hook, container } = mount(long());
    act(() => hook.result.current.startEdit('a'));
    expect(overlayOf(container).style.whiteSpace).toBe('pre');
  });

  it('wraps the overlay at the box when the style declares wrap', () => {
    const { hook, container } = mount(long({ wrap: true }));
    act(() => hook.result.current.startEdit('a'));
    const el = overlayOf(container);
    expect(el.style.whiteSpace).toBe('pre-wrap');
    expect(el.style.width).toBe('50px');
    // The canvas never breaks inside a word, so neither may the overlay.
    expect(el.style.overflowWrap).toBe('normal');
  });

  it('grows an unwrapped centered overlay about the box center, as the canvas does', () => {
    const { hook, container } = mount(long({ align: 'center' }));
    act(() => hook.result.current.startEdit('a'));
    const el = overlayOf(container);
    expect(el.style.width).toBe('max-content');
    expect(el.style.minWidth).toBe('50px');
    // Anchored on the box center (100 + 25).
    expect(el.style.left).toBe('125px');
    expect(el.style.transform).toBe('translateX(-50%)');
  });

  it('puts a double-click below an unwrapped line at its end, not on a line never drawn', () => {
    const { hook, container } = mount(long());
    act(() => openAt(hook.result.current, 110, 50 + LINE + 5));
    expect(hook.result.current.editingId).toBe('a');
    const sel = window.getSelection()!;
    expect(overlayOf(container).contains(sel.anchorNode)).toBe(true);
    expect(sel.anchorOffset).toBe('AB AB AB'.length);
  });

  it('maps a double-click through the node\'s verticalAlign, as the painter does', () => {
    // One 'AB AB' line bottom-aligned in the 200-tall box sits at y 211.6..250.
    const item = { ...long(), text: 'AB AB', runs: [{ text: 'AB AB' }], width: 400, verticalAlign: 'bottom' as const };
    const { hook } = mount(item);
    // Between A's and B's midpoints, on that line.
    act(() => openAt(hook.result.current, 130, 220));
    const sel = window.getSelection()!;
    expect(sel.anchorNode?.nodeType).toBe(Node.TEXT_NODE);
    expect(sel.anchorOffset).toBe(1);
  });
});

describe('useSceneTextEdit — a commit that changes nothing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  type Item = Omit<TextItem, 'text'> & { text?: string; runs?: { text: string; bold?: boolean }[] };

  function mount(item: Item) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const hook = renderHook(() => {
      const scene = useScene({ items: [item] });
      return { scene, edit: useSceneTextEdit(scene, container) };
    });
    return { hook, container };
  }

  it('writes no text onto a node that had none', () => {
    const { hook } = mount({ id: 'box', x: 0, y: 0, width: 100, height: 100 });
    act(() => hook.result.current.edit.startEdit('box'));
    act(() => hook.result.current.edit.commitEdit());
    const { scene } = hook.result.current;
    expect('text' in scene.get(asNodeId('box'))!.data).toBe(false);
    expect(scene.canUndo()).toBe(false);
  });

  it('leaves no undo step behind an untouched text or its runs', () => {
    const { hook } = mount({ ...NODE, runs: [{ text: 'hel', bold: true }, { text: 'lo' }] });
    act(() => hook.result.current.edit.startEdit('a'));
    act(() => hook.result.current.edit.commitEdit());
    expect(hook.result.current.scene.canUndo()).toBe(false);
  });

  it('still writes an edit that changed the text', () => {
    const { hook, container } = mount(NODE);
    act(() => hook.result.current.edit.startEdit('a'));
    overlayOf(container).textContent = 'goodbye';
    act(() => hook.result.current.edit.commitEdit());
    const { scene } = hook.result.current;
    expect(scene.get(asNodeId('a'))!.data.text).toBe('goodbye');
    expect(scene.canUndo()).toBe(true);
  });
});

describe('useSceneTextEdit — one undo step per edit', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const ITALIC = {
    id: 'a', x: 0, y: 0, width: 200, height: 40,
    text: 'one two',
    style: { fontSize: 16, fontStyle: 'italic' as const },
    runs: [{ text: 'one two' }] as { text: string; italic?: boolean; bold?: boolean }[],
  };

  function mount(escape?: 'cancel' | 'commit') {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const hook = renderHook(() => {
      const scene = useScene({ items: [ITALIC] });
      return { scene, edit: useSceneTextEdit(scene, container, { escape }) };
    });
    act(() => hook.result.current.edit.startEdit('a'));
    return { hook, overlay: overlayOf(container) };
  }

  async function press(overlay: HTMLElement, key: string, select?: [number, number]) {
    await act(async () => {
      if (select) {
        const text = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT).nextNode() as Text;
        const range = document.createRange();
        range.setStart(text, select[0]);
        range.setEnd(text, select[1]);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        await new Promise((r) => setTimeout(r, 0));
      }
      overlay.dispatchEvent(new KeyboardEvent('keydown', {
        key, metaKey: key.length === 1, bubbles: true, cancelable: true,
      }));
    });
  }

  it('undoes text, runs, and a rewritten node style together', async () => {
    const { hook, overlay } = mount();
    await press(overlay, 'i', [4, 7]);
    act(() => hook.result.current.edit.commitEdit());
    const { scene } = hook.result.current;
    const after = scene.get(asNodeId('a'))!.data;
    expect(after.style).toEqual({ fontSize: 16, fontStyle: 'normal' });
    expect(after.runs).toEqual([{ text: 'one ', italic: true }, { text: 'two' }]);

    act(() => { scene.undo(); });
    const back = hook.result.current.scene.get(asNodeId('a'))!.data;
    expect(back.style).toEqual(ITALIC.style);
    expect(back.runs).toEqual(ITALIC.runs);
    expect(hook.result.current.scene.canUndo()).toBe(false);
  });

  it('undoes changed text and its runs in one step', () => {
    const { hook, overlay } = mount();
    overlay.querySelector('span[data-run]')!.textContent = 'three';
    act(() => hook.result.current.edit.commitEdit());
    const { scene } = hook.result.current;
    expect(scene.get(asNodeId('a'))!.data.text).toBe('three');
    expect(scene.get(asNodeId('a'))!.data.runs).toEqual([{ text: 'three' }]);

    act(() => { scene.undo(); });
    const back = hook.result.current.scene.get(asNodeId('a'))!.data;
    expect(back.text).toBe('one two');
    expect(back.runs).toEqual(ITALIC.runs);
    expect(hook.result.current.scene.canUndo()).toBe(false);
  });

  it('leaves the node alone when Escape cancels after a node flag was lowered', async () => {
    const { hook, overlay } = mount('cancel');
    await press(overlay, 'i', [4, 7]);
    await press(overlay, 'Escape');
    const { scene, edit } = hook.result.current;
    expect(edit.editingId).toBeNull();
    expect(scene.get(asNodeId('a'))!.data.style).toEqual(ITALIC.style);
    expect(scene.canUndo()).toBe(false);
  });
});

describe('useSceneTextEdit — abandoned renders', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('writes through the committed options, not an abandoned render\'s', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const setA = vi.fn((data: TextItem, text: string) => ({ ...data, text }));
    const setB = vi.fn((data: TextItem, text: string) => ({ ...data, text }));
    let api: ReturnType<typeof useSceneTextEdit> | null = null;
    let abandon: () => void = () => {};
    function Host(): ReturnType<typeof createElement> {
      const [b, setWhich] = useState(false);
      abandon = () => setWhich(true);
      const scene = useScene({ items: [NODE] });
      api = useSceneTextEdit(scene, container, { setText: b ? setB : setA });
      return createElement(Suspense, { fallback: null }, createElement(Hang, { hang: b }));
    }
    render(createElement(Host));
    act(() => api!.startEdit('a'));
    act(() => { startTransition(() => abandon()); });
    const el = container.querySelector('div[contenteditable="true"]')!;
    el.textContent = 'goodbye';
    await act(async () => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(setB).not.toHaveBeenCalled();
    expect(setA).toHaveBeenCalledTimes(1);
  });
});
