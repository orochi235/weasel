/**
 * The entered group under every tool: Escape and a double-click work whichever tool is active,
 * what is drawn or pasted while a group is entered lands in it, and a marquee reaches only the
 * nodes a press could.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useCallback } from 'react';
import { useActionsRegistry, useDepSource, useOptionalDepRegistry } from '@weasel-js/routing/react';
import type { ActionsRegistry } from '@weasel-js/routing';
import { useClipboardOps } from 'interactions/actions/clipboard/clipboardOps';
import { useSceneAdapter } from './useSceneAdapter';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId } from 'core/scene/types';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';
import { createEnteredGroup } from './deps/enteredGroup';
import { SceneCanvas } from './SceneCanvas';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

type D = { path?: PolygonPath };
type P = { x: number; y: number; width: number; height: number };
const box = (x: number, w = 30): P => ({ x, y: 0, width: w, height: 30 });
const triangle = () => pathFromD('M 0 0 L 30 0 L 30 30 Z') as PolygonPath;

function setup(tool: 'select' | 'rect' = 'select') {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: asNodeId('g'), kind: 'group', layer: 'main', pose: box(0, 100), data: {} } as never);
  scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'main', parent: asNodeId('g'), pose: box(0), data: { path: triangle() } } as never);
  scene.add({ id: asNodeId('f'), kind: 'mark', layer: 'main', pose: box(150), data: { path: triangle() } } as never);
  const entered = createEnteredGroup(scene);
  let sel!: SelectionApi;
  let actions!: ActionsRegistry;
  // Publishes a clipboard the way an app does, on an adapter of its own that pastes where `insertInto` says.
  function Grab() {
    actions = useActionsRegistry()!;
    const deps = useOptionalDepRegistry();
    const pasteInto = useCallback(() => deps?.get('insertInto')?.get() ?? null, [deps]);
    const adapter = useSceneAdapter(scene, { pasteInto });
    const clipboard = useClipboardOps(adapter, { getSelection: () => sel.current as NodeId[] });
    useDepSource('clipboard', () => clipboard);
    return null;
  }
  function Canvas() {
    sel = useSelection({ mode: 'multi', scene });
    return (
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={300} height={100} selection={sel}
        enteredGroup={entered} defaultTools={['select', 'rect']} initialActiveTool={tool}>
        <Grab />
      </SceneCanvas>
    );
  }
  const { container } = render(<Canvas />);
  const canvas = container.querySelector('canvas')!;
  const fire = (type: string, x: number, y: number, init: PointerEventInit = {}) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1, ...init }));
  const press = (x: number, y = 15) => act(() => { fire('pointerdown', x, y); fire('pointerup', x, y); });
  const doubleClick = (x: number) => { press(x); press(x); };
  const drag = (from: [number, number], to: [number, number]) => act(() => {
    fire('pointerdown', ...from);
    fire('pointermove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
    fire('pointermove', ...to);
    fire('pointerup', ...to, { buttons: 0 });
  });
  const escape = () => act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  const added = (before: ReadonlySet<string>) => [...scene.nodes.keys()].filter((id) => !before.has(id));
  return {
    scene, entered, press, doubleClick, drag, escape, added,
    trigger: (id: string) => { let ok = false; act(() => { ok = actions.trigger(id); }); return ok; },
    selection: () => [...sel.current],
    ids: () => new Set<string>(scene.nodes.keys()),
  };
}

describe('the entered group under a drawing tool', () => {
  it('a double-click on a member enters the group under the Rect tool', () => {
    const t = setup('rect');
    t.doubleClick(15);
    expect(t.entered.get()).toBe('g');
  });

  it('Escape leaves the group under the Rect tool', () => {
    const t = setup('rect');
    act(() => { t.entered.enter(asNodeId('g')); });
    t.press(200, 80);
    t.escape();
    expect(t.entered.get()).toBeNull();
  });

  it('a Rect drag outside the group draws into it and leaves it entered', () => {
    const t = setup('rect');
    act(() => { t.entered.enter(asNodeId('g')); });
    const before = t.ids();
    t.drag([200, 40], [260, 90]);
    const [made] = t.added(before);
    expect(made).toBeDefined();
    expect(t.scene.get(made as NodeId)?.parent).toBe('g');
    expect(t.entered.get()).toBe('g');
  });
});

describe('pasting while a group is entered', () => {
  it('lands the pasted copy in the entered group', () => {
    const t = setup();
    act(() => { t.entered.enter(asNodeId('g')); });
    t.press(15);
    expect(t.selection()).toEqual(['a']);
    expect(t.trigger('clipboard.copy')).toBe(true);
    const before = t.ids();
    expect(t.trigger('clipboard.paste')).toBe(true);
    const made = t.added(before);
    expect(made).toHaveLength(1);
    expect(t.scene.get(made[0] as NodeId)?.parent).toBe('g');
  });
});

describe('region selection while a group is entered', () => {
  // A marquee started outside the group's box would leave the group on its press, so these start inside it.
  it('a marquee across a node outside the entered group passes over it', () => {
    const t = setup();
    act(() => { t.entered.enter(asNodeId('g')); });
    t.drag([95, 28], [290, 95]);
    expect(t.entered.get()).toBe('g');
    expect(t.selection()).not.toContain('f');
  });

  it('a marquee inside the entered group takes its members', () => {
    const t = setup();
    act(() => { t.entered.enter(asNodeId('g')); });
    t.drag([95, 28], [-5, -5]);
    expect(t.selection()).toEqual(['a']);
  });
});

describe('select all while a group is entered', () => {
  it('selects only what is inside the entered group', () => {
    const t = setup();
    act(() => { t.entered.enter(asNodeId('g')); });
    expect(t.trigger('selectAll')).toBe(true);
    expect(t.selection()).toEqual(['a']);
  });
});
