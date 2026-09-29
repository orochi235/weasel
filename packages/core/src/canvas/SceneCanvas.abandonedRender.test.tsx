/**
 * `<SceneCanvas>` answers chrome visibility and routes events from props held
 * for later. A render React throws away (`b` here) must leave those answers on
 * the last committed props (`a`).
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { SceneCanvas, type SceneCanvasProps } from './SceneCanvas';
import type { CanvasHelpers } from './Canvas';
import { createScene } from 'core/scene/scene';
import type { Scene, NodeId } from 'core/scene/types';
import { never } from 'features/chrome-caps';

type D = { kind: string };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };
type Props = SceneCanvasProps<D, L, P>;

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

afterEach(() => { cleanup(); });

function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main', pose: { x: 100, y: 100, width: 80, height: 60 } });
  });
  return s;
}

function firstId(scene: Scene<D, L, P>): NodeId {
  for (const id of scene.renderOrder()) return id;
  throw new Error('No nodes');
}

function selectionOf(ids: NodeId[]): Props['selection'] {
  return {
    current: ids,
    get: () => [...ids],
    set() {}, add() {}, remove() {}, toggle() {}, clear() {},
    contains: (id: NodeId) => ids.includes(id),
    applyClick() {},
    adapterMethods: { getSelection: () => [...ids], setSelection: () => {} },
  } as unknown as Props['selection'];
}

/** Commits `a`, abandons `b`, and answers chrome visibility as the canvas now would. */
function visibilityAfterAbandon(
  scene: Scene<D, L, P>,
  a: Partial<Props>,
  b: Partial<Props>,
): (id: string) => boolean {
  const helpersRef = { current: null as CanvasHelpers<P> | null };
  renderThenAbandon(a, b, (p) => (
    <SceneCanvas features={['draw']} scene={scene} layers={{}} width={400} height={400}
      helpersRef={helpersRef} {...p} />
  ));
  return helpersRef.current!.getIsVisible();
}

describe('<SceneCanvas> after an abandoned render', () => {
  it('resolves chrome against the committed chromeVisibility', () => {
    const scene = makeScene();
    const selection = selectionOf([firstId(scene)]);
    const isVisible = visibilityAfterAbandon(
      scene,
      { selection, chromeVisibility: {} },
      { selection, chromeVisibility: { 'selection.outline': never } },
    );
    expect(isVisible('selection.outline')).toBe(true);
  });

  it('resolves chrome against the committed selection', () => {
    const scene = makeScene();
    const isVisible = visibilityAfterAbandon(
      scene,
      { selection: selectionOf([firstId(scene)]) },
      { selection: selectionOf([]) },
    );
    expect(isVisible('selection.outline')).toBe(true);
  });

  it('resolves chrome against the committed getFocused', () => {
    const scene = makeScene();
    const selection = selectionOf([firstId(scene)]);
    const isVisible = visibilityAfterAbandon(
      scene,
      { selection, getFocused: () => true },
      { selection, getFocused: () => false },
    );
    expect(isVisible('selection.rotation-handle')).toBe(true);
  });

  it('resolves chrome against the committed resizable predicate', () => {
    const scene = makeScene();
    const selection = selectionOf([firstId(scene)]);
    const isVisible = visibilityAfterAbandon(
      scene,
      { selection, selectTool: { resize: { resizable: () => true } } as Props['selectTool'] },
      { selection, selectTool: { resize: { resizable: () => false } } as Props['selectTool'] },
    );
    expect(isVisible('selection.resize-handles')).toBe(true);
  });

  it('reports a double click to the committed onDoubleClick', () => {
    const scene = makeScene();
    const a = vi.fn();
    const b = vi.fn();
    renderThenAbandon(a, b, (onDoubleClick) => (
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={400} height={400}
        onDoubleClick={onDoubleClick} />
    ));
    const canvas = document.querySelector('canvas')!;
    const press = (type: string) => canvas.dispatchEvent(
      new PointerEvent(type, { bubbles: true, clientX: 140, clientY: 130, pointerId: 1 }),
    );
    act(() => {
      press('pointerdown'); press('pointerup');
      press('pointerdown'); press('pointerup');
    });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });
});
