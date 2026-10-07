/**
 * `<SceneCanvas features>` — a bare canvas only renders; each preset turns on
 * its own behavior, independently of the others.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { SceneCanvas, type Feature } from './SceneCanvas';
import type { CanvasHelpers } from './useViewHelpers';
import { createScene } from 'core/scene/scene';
import type { Scene, NodeId } from 'core/scene/types';
import { useActionsRegistry, useDepRegistry } from '@weasel-js/routing/react';
import type { Action } from '@weasel-js/routing';
import type { ToolsApi } from '../tools/overlayBinding';
import type { SelectionApi } from 'core/selection/useSelection';
import { KIT_STANDARD_ACTION_IDS } from 'interactions/actions/useStandardActions';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number; rotation: number };

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

function makeScene(): { scene: Scene<D, L, P>; id: NodeId } {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  let id!: NodeId;
  s.batch('seed', () => {
    id = s.add({
      kind: 'leaf', data: { kind: 'rect' }, layer: 'main' as L,
      pose: { x: 0, y: 0, width: 50, height: 50, rotation: 0 } as P,
    });
  });
  return { scene: s, id };
}

function drag(canvas: Element, from: [number, number], to: [number, number], init: PointerEventInit = {}): void {
  const opts = (x: number, y: number) => ({ bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, ...init });
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', opts(...from)));
    canvas.dispatchEvent(new PointerEvent('pointermove', opts(...to)));
    canvas.dispatchEvent(new PointerEvent('pointerup', opts(...to)));
  });
}

function click(canvas: Element, at: [number, number]): void {
  const opts = { bubbles: true, clientX: at[0], clientY: at[1], pointerId: 1, button: 0 };
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
    canvas.dispatchEvent(new PointerEvent('pointerup', opts));
  });
}

function key(k: string): void {
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); });
  act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true })); });
}

interface Seen { actionIds: string[]; selection: SelectionApi | null }

function Probe({ into }: { into: Seen }) {
  const reg = useActionsRegistry();
  const deps = useDepRegistry();
  useEffect(() => {
    into.actionIds = reg ? reg.list().map((a) => a.id) : [];
    into.selection = (deps.get('selection') as SelectionApi | undefined) ?? null;
  });
  return null;
}

function mount(props: { features?: readonly Feature[] } & Record<string, unknown> = {}) {
  const { scene, id } = makeScene();
  const seen: Seen = { actionIds: [], selection: null };
  let tools: ToolsApi | null = null;
  const result = render(
    <SceneCanvas
      scene={scene} width={200} height={200}
      onToolsCreated={(t) => { tools = t; }}
      {...props}
    >
      <Probe into={seen} />
    </SceneCanvas>,
  );
  const canvas = result.container.querySelector('canvas')!;
  return { scene, id, seen, canvas, tools: () => tools!, ...result };
}

const xOf = (scene: Scene<D, L, P>, id: NodeId) => (scene.get(id)!.pose as P).x;
const kitIds = (ids: string[]) => ids.filter((i) => KIT_STANDARD_ACTION_IDS.includes(i));

describe('a bare <SceneCanvas>', () => {
  it('registers no tool and no kit action, and mounts without an active tool', () => {
    const { seen, tools } = mount();
    expect(tools().active).toBe(null);
    expect(Object.keys(tools().registry)).toEqual([]);
    expect(kitIds(seen.actionIds)).toEqual([]);
    expect(seen.actionIds.filter((i) => i.startsWith('tool.'))).toEqual([]);
  });

  it('keeps a selection that input does not set', () => {
    const { seen, canvas, id } = mount();
    click(canvas, [10, 10]);
    expect(seen.selection!.get()).toEqual([]);
    act(() => seen.selection!.set([id]));
    expect(seen.selection!.get()).toEqual([id]);
  });

  it('does not move the selection on drag', () => {
    const { seen, canvas, id, scene } = mount();
    act(() => seen.selection!.set([id]));
    drag(canvas, [10, 10], [40, 10]);
    expect(xOf(scene, id)).toBe(0);
  });

  it('routes a consumer ambient binding on empty canvas, with no base tool ahead of it', () => {
    const pressed = vi.fn();
    const press: Action = {
      id: 'test.press', label: 'Press',
      invoker: { timing: 'immediate', run: () => pressed() },
    };
    const { canvas } = mount({
      ambient: [{ id: 'presser', eligibility: {}, bindings: [{ spec: { kind: 'pointerDown' }, actionId: 'test.press' }] }],
      actions: { 'test.press': press },
    });
    click(canvas, [150, 150]);
    expect(pressed).toHaveBeenCalledTimes(1);
  });

  it('does nothing on Escape', () => {
    const { tools } = mount();
    expect(() => key('Escape')).not.toThrow();
    expect(tools().active).toBe(null);
  });
});

describe('<SceneCanvas features>', () => {
  it("'pick' makes select the active tool and picks on click, without moving", () => {
    const { seen, canvas, id, scene, tools } = mount({ features: ['pick'] });
    expect(tools().active).toBe('select');
    click(canvas, [10, 10]);
    expect(seen.selection!.get()).toEqual([id]);
    drag(canvas, [10, 10], [40, 10]);
    expect(xOf(scene, id)).toBe(0);
  });

  it("'pick' + 'move' drags an unselected body to move it", () => {
    const { canvas, id, scene } = mount({ features: ['pick', 'move'] });
    drag(canvas, [10, 10], [40, 10]);
    expect(xOf(scene, id)).toBe(30);
  });

  it("'transform' takes a handle drag ahead of 'move', though the handle sits on the body", () => {
    const { seen, canvas, id, scene } = mount({ features: ['pick', 'move', 'transform'] });
    act(() => seen.selection!.set([id]));
    drag(canvas, [50, 50], [70, 70]);
    const pose = scene.get(id)!.pose as P;
    expect(pose.x).toBe(0);
    expect(pose.width).toBe(70);
  });

  it("'transform' takes a drag on the rotation handle, which sits off the body, from the select tool's marquee", () => {
    const { seen, canvas, id, scene } = mount({ features: ['pick', 'transform'] });
    act(() => seen.selection!.set([id]));
    drag(canvas, [25, -24], [60, 10]);
    expect((scene.get(id)!.pose as P).rotation).not.toBe(0);
  });

  it("without 'transform' a handle is neither drawn nor grabbed", () => {
    const { seen, canvas, id, scene } = mount({ features: ['pick', 'move'] });
    act(() => seen.selection!.set([id]));
    drag(canvas, [50, 50], [70, 70]);
    const pose = scene.get(id)!.pose as P;
    expect(pose.width).toBe(50);
  });

  it("'resize' takes a handle drag, and the rotation handle is neither drawn nor grabbed", () => {
    const helpersRef: { current: CanvasHelpers<P> | null } = { current: null };
    const { seen, canvas, id, scene } = mount({ features: ['pick', 'resize'], helpersRef });
    act(() => seen.selection!.set([id]));
    const isVisible = helpersRef.current!.getIsVisible();
    expect(isVisible('selection.resize-handles')).toBe(true);
    expect(isVisible('selection.rotation-handle')).toBe(false);
    expect(seen.actionIds).toContain('resize');
    expect(seen.actionIds).not.toContain('rotate');

    drag(canvas, [25, -24], [60, 10]);
    expect((scene.get(id)!.pose as P).rotation).toBe(0);
    drag(canvas, [50, 50], [70, 70]);
    expect((scene.get(id)!.pose as P).width).toBe(70);
  });

  it("'rotate' takes the rotation handle, and the resize handles are neither drawn nor grabbed", () => {
    const helpersRef: { current: CanvasHelpers<P> | null } = { current: null };
    const { seen, canvas, id, scene } = mount({ features: ['pick', 'rotate'], helpersRef });
    act(() => seen.selection!.set([id]));
    const isVisible = helpersRef.current!.getIsVisible();
    expect(isVisible('selection.resize-handles')).toBe(false);
    expect(isVisible('selection.rotation-handle')).toBe(true);
    expect(seen.actionIds).not.toContain('resize');

    drag(canvas, [50, 50], [70, 70]);
    expect((scene.get(id)!.pose as P).width).toBe(50);
    drag(canvas, [25, -24], [60, 10]);
    expect((scene.get(id)!.pose as P).rotation).not.toBe(0);
  });

  it("'outline' draws the selection outline without mounting the select tool", () => {
    const helpersRef: { current: CanvasHelpers<P> | null } = { current: null };
    const { seen, id, tools } = mount({ features: ['outline'], helpersRef });
    act(() => seen.selection!.set([id]));
    expect(helpersRef.current!.getIsVisible()('selection.outline')).toBe(true);
    expect(Object.keys(tools().registry)).toEqual([]);
    expect(tools().active).toBe(null);
  });

  it("'select' mounts the select tool without the selection outline", () => {
    const helpersRef: { current: CanvasHelpers<P> | null } = { current: null };
    const { seen, canvas, id, tools } = mount({ features: ['select'], helpersRef });
    expect(tools().active).toBe('select');
    click(canvas, [10, 10]);
    expect(seen.selection!.get()).toEqual([id]);
    expect(helpersRef.current!.getIsVisible()('selection.outline')).toBe(false);
  });

  it("'move' runs under a tool that leaves the drag unclaimed", () => {
    const { seen, canvas, id, scene, tools } = mount({
      features: ['move'],
      tools: { idle: { id: 'idle', eligibility: {}, bindings: [] } },
      initialActiveTool: 'idle',
    });
    expect(tools().active).toBe('idle');
    act(() => seen.selection!.set([id]));
    drag(canvas, [10, 10], [40, 10]);
    expect(xOf(scene, id)).toBe(30);
  });

  it("'edit' binds Delete; without it the key does nothing", () => {
    const bare = mount({ features: ['pick'] });
    act(() => bare.seen.selection!.set([bare.id]));
    key('Delete');
    expect(bare.scene.get(bare.id)).toBeDefined();
    bare.unmount();

    const edit = mount({ features: ['pick', 'edit'] });
    act(() => edit.seen.selection!.set([edit.id]));
    key('Delete');
    expect(edit.scene.get(edit.id)).toBeUndefined();
  });

  it("'draw' registers every kit action a bare canvas leaves out", () => {
    const { seen, tools } = mount({ features: ['draw'] });
    expect(tools().active).toBe('select');
    expect(Object.keys(tools().registry).sort()).toEqual(['hand', 'select']);
    const missing = KIT_STANDARD_ACTION_IDS.filter((i) => !seen.actionIds.includes(i));
    // Only the actions that belong to insert and text tools stay out.
    expect(missing.sort()).toEqual(['enterTextEdit', 'insert', 'insert.adjustRotation']);
  });

  it('registers the kit actions a registered tool binds', () => {
    const { seen } = mount({ defaultTools: ['rect'] });
    expect(seen.actionIds).toContain('insert');
  });

  it('initialActiveTool overrides the select default', () => {
    const { tools } = mount({ features: ['pick'], defaultTools: ['rect'], initialActiveTool: 'rect' });
    expect(tools().active).toBe('rect');
  });

  it('a viewport config implies view: the hand tool is registered', () => {
    const { tools, seen } = mount({ viewport: {} });
    expect(Object.keys(tools().registry)).toEqual(['hand']);
    expect(seen.actionIds).toContain('viewport.wheelPan');
  });

  it("'draw' no longer rotates a selection on a drag no tool claims", () => {
    const { seen, canvas, id, scene } = mount({
      features: ['draw'],
      tools: { idle: { id: 'idle', eligibility: {}, bindings: [] } },
      initialActiveTool: 'idle',
    });
    act(() => seen.selection!.set([id]));
    const before = JSON.stringify(scene.get(id)!.pose);
    drag(canvas, [150, 150], [150, 190]);
    expect(JSON.stringify(scene.get(id)!.pose)).toBe(before);
  });
});
