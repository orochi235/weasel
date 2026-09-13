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
import { act, renderHook } from '@testing-library/react';
import type { MouseEvent } from 'react';
import { useScene } from '../../core/scene/useScene';
import { asNodeId } from '../../core/scene/types';
import type { View } from '../../core/viewport/view';
import { registerMountedCanvas } from '../../canvas/mountedCanvases';
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
    expect(el.style.minWidth).toBe('200px');
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
    expect(el.style.minWidth).toBe('200px');
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

  it('does not open the editor on a node whose layer is locked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const hook = renderHook(() => {
      const scene = useScene({ items: [NODE] });
      return { scene, edit: useSceneTextEdit(scene, container) };
    });
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    const click = {
      target: canvas, clientX: 110, clientY: 60,
    } as unknown as MouseEvent<HTMLElement>;

    const { scene } = hook.result.current;
    act(() => scene.setLayerLocked(scene.layers[0]!.id, true));
    act(() => hook.result.current.edit.onDoubleClick(click));
    expect(hook.result.current.edit.editingId).toBeNull();

    act(() => scene.setLayerLocked(scene.layers[0]!.id, false));
    act(() => hook.result.current.edit.onDoubleClick(click));
    expect(hook.result.current.edit.editingId).toBe('a');
  });

  it('opens the editor from a double-click whose target is not a canvas', () => {
    // Under `paintInto` the dblclick target is the caller's input box, so the
    // old `instanceof HTMLCanvasElement` gate made text editing a silent no-op
    // on every detached surface.
    let live: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const { hook, container } = renderThunkEdit(() => live);
    const box = document.createElement('div');
    container.appendChild(box);

    live = { x: 100, y: 50, scale: { x: 1, y: 1 } };
    act(() => hook.result.current.onDoubleClick({
      target: box, clientX: 10, clientY: 10,
    } as unknown as MouseEvent<HTMLElement>));
    expect(hook.result.current.editingId).toBe('a');
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
      // (100 - 20) * 2 = 160, (50 - 10) * 2 = 80, plus the nudge.
      expect(el.style.left).toBe('161px');
      expect(el.style.top).toBe('79px');
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
      const clip = el.parentElement!;
      expect(clip).not.toBe(container);
      expect(clip.style.overflow).toBe('clip');
      expect([clip.style.left, clip.style.top, clip.style.width, clip.style.height])
        .toEqual(['40px', '30px', '600px', '400px']);
      // World (100, 50) is canvas (100, 50), container (140, 80), clip box
      // (100, 50) — plus the nudge.
      expect(el.style.left).toBe('101px');
      expect(el.style.top).toBe('49px');
    } finally {
      dispose();
    }
  });

  it('un-projects a double-click through the canvas it landed on', () => {
    const { hook, container, canvas: first } = mount();
    const second = document.createElement('canvas');
    container.appendChild(second);
    const disposeFirst = registerMountedCanvas({
      element: first,
      getView: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }),
    });
    const disposeSecond = registerMountedCanvas({
      element: second,
      getView: () => ({ x: 100, y: 50, scale: { x: 1, y: 1 } }),
    });
    try {
      // Canvas-space (10, 10) is inside the node only through the second
      // canvas's camera.
      act(() => hook.result.current.onDoubleClick({
        target: second, clientX: 10, clientY: 10,
      } as unknown as MouseEvent<HTMLElement>));
      expect(hook.result.current.editingId).toBe('a');
    } finally {
      disposeFirst();
      disposeSecond();
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
            id: asNodeId('anchor'), kind: 'leaf', layer: 'main',
            pose: { x: 0, y: 0, width: 10, height: 10 }, data: {},
          },
          {
            id: asNodeId('label'), kind: 'leaf', layer: 'main',
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
    act(() => hook.result.current.onDoubleClick({
      target: canvas, clientX: 320, clientY: 10,
    } as unknown as MouseEvent<HTMLElement>));
    expect(hook.result.current.editingId).toBe('label');
  });

  it('does not hit-test against the authored placeholder', () => {
    const { hook, container } = renderDerived();
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    act(() => hook.result.current.onDoubleClick({
      target: canvas, clientX: 20, clientY: 10,
    } as unknown as MouseEvent<HTMLElement>));
    expect(hook.result.current.editingId).toBeNull();
  });

  it('places the overlay at the derived pose', () => {
    const { hook, container } = renderDerived();
    act(() => hook.result.current.startEdit('label'));
    expect(overlayOf(container).style.left).toBe('301px');
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
    // Runs, because jsdom has no `innerText` to seed a plain-text overlay with.
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
    const target = document.createElement('div');
    container.appendChild(target);
    const hook = renderHook(() => {
      const scene = useScene({ items: [item] });
      return useSceneTextEdit(scene, container);
    });
    return { hook, container, target };
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
    // Anchored on the box center (100 + 25), plus the nudge.
    expect(el.style.left).toBe('126px');
    expect(el.style.transform).toBe('translateX(-50%)');
  });

  it('puts a double-click below an unwrapped line at its end, not on a line never drawn', () => {
    const { hook, container, target } = mount(long());
    act(() => hook.result.current.onDoubleClick({
      target, clientX: 110, clientY: 50 + LINE + 5,
    } as unknown as MouseEvent<HTMLElement>));
    expect(hook.result.current.editingId).toBe('a');
    const sel = window.getSelection()!;
    expect(overlayOf(container).contains(sel.anchorNode)).toBe(true);
    expect(sel.anchorOffset).toBe('AB AB AB'.length);
  });

  it('maps a double-click through the node\'s verticalAlign, as the painter does', () => {
    // One 'AB AB' line bottom-aligned in the 200-tall box sits at y 211.6..250.
    const item = { ...long(), text: 'AB AB', runs: [{ text: 'AB AB' }], width: 400, verticalAlign: 'bottom' as const };
    const { hook, target } = mount(item);
    // Between A's and B's midpoints, on that line.
    act(() => hook.result.current.onDoubleClick({
      target, clientX: 130, clientY: 220,
    } as unknown as MouseEvent<HTMLElement>));
    const sel = window.getSelection()!;
    expect(sel.anchorNode?.nodeType).toBe(Node.TEXT_NODE);
    expect(sel.anchorOffset).toBe(1);
  });
});
