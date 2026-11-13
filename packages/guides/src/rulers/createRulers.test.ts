import { describe, expect, it, vi } from 'vitest';
import {
  asNodeId, createScene,
  type ActionDeps, type CanvasExtensionApi, type ContributionFrameCtx, type ImmediateInvoker, type InvocationCtx,
  type OngoingInvoker, type RectPose, type RenderLayer, type UnitScope, type View,
} from '@weasel-js/core';
import { METRIC_MM } from '@weasel-js/quantity';
import type { Guide } from '../guides/types';
import { createRulers, type RulersOptions } from './createRulers';

const PT: UnitScope = { system: { base: 'pt', units: { pt: 1, in: 72 } } };
const MM: UnitScope = { system: METRIC_MM, scale: 72 / 25.4 };
const VIEW: View = { x: -20, y: -20, scale: { x: 1, y: 1 } };
const MODS = { shift: false, alt: false, meta: false, ctrl: false };

function store() {
  const list: Guide[] = [];
  return {
    list,
    getGuides: () => list,
    // As `useGuides` does: an id already held is replaced in place, a new one goes in at `index`.
    addGuide: (g: Guide, index?: number) => {
      const i = list.findIndex((h) => h.id === g.id);
      if (i >= 0) list[i] = g;
      else list.splice(index ?? list.length, 0, g);
    },
    removeGuide: (id: string) => { const i = list.findIndex((g) => g.id === id); if (i >= 0) list.splice(i, 1); },
  };
}

function fixture(opts: Partial<RulersOptions> = {}) {
  const guides = store();
  const rulers = createRulers({ guides, root: PT, newGuideId: () => 'g1', ...opts });
  const layers: readonly RenderLayer<unknown>[] = rulers.contribution.layers ?? [];
  const api = {
    requestRedraw: () => {},
    getSurfaceRect: () => ({ x: 0, y: 0, width: 400, height: 300 }),
  } as unknown as CanvasExtensionApi;
  rulers.contribution.attach!(api, { get: () => undefined });
  rulers.contribution.beforePaint!({ view: VIEW } as ContributionFrameCtx);
  const action = (suffix: string) => rulers.contribution.actions!.find((a) => a.id === `rulers.${suffix}`)!;
  return { guides, rulers, layers, action };
}

const screenToWorld = (x: number, y: number) => ({ x: x + VIEW.x, y: y + VIEW.y });

function drag(action: ReturnType<ReturnType<typeof fixture>['action']>, deps: ActionDeps, part: string, from: { x: number; y: number }) {
  const at = (p: { x: number; y: number }): InvocationCtx => ({
    world: p, modifiers: MODS, deps,
    drag: { start: from, current: p, delta: { x: p.x - from.x, y: p.y - from.y }, affordance: { payload: { part } } as never },
  });
  const handle = (action.invoker as OngoingInvoker).start(at(from));
  return { move: (p: { x: number; y: number }) => handle.onMove?.(at(p)), end: (p: { x: number; y: number }, reason: 'commit' | 'cancel' = 'commit') => handle.onEnd?.(at(p), reason), handle };
}

describe('createRulers', () => {
  it('refuses a second canvas while one is attached, and keeps serving the first', () => {
    const { rulers } = fixture();
    const other = {
      registerLayer: () => () => {},
      requestRedraw: () => {},
      getSurfaceRect: () => ({ x: 0, y: 0, width: 10, height: 10 }),
    } as unknown as CanvasExtensionApi;
    expect(() => rulers.contribution.attach!(other, { get: () => undefined })).toThrow(/one canvas/);
    rulers.contribution.beforePaint!({ view: VIEW } as ContributionFrameCtx);
    expect(rulers.get().width).toBe(400);
  });

  it('claims presses on the strips along the top and left, and the corner', () => {
    const { layers } = fixture();
    const hit = layers.find((l) => l.id === 'rulers-hit')!;
    const partAt = (x: number, y: number) => {
      const w = screenToWorld(x, y);
      return (hit.hitTest!(w.x, w.y, undefined, VIEW, { width: 400, height: 300 }) as { initialScratch?: { part: string } } | null)?.initialScratch?.part ?? null;
    };
    expect([partAt(100, 10), partAt(10, 100), partAt(10, 10), partAt(100, 100)]).toEqual(['top', 'left', 'corner', null]);
  });

  it('follows the view and the canvas size, and lays out both rulers', () => {
    const { rulers } = fixture({ majorPx: 72 });
    expect(rulers.get()).toMatchObject({ view: VIEW, width: 400, height: 300 });
    const layout = rulers.layout()!;
    // World zero sits 20 px in; a point is a pixel, so 1 in is 72 px.
    expect(layout.top.ticks.filter((t) => t.major).map((t) => [t.at, t.label])).toEqual([[20, '0'], [92, '1'], [164, '2'], [236, '3'], [308, '4'], [380, '5']]);
    expect(layout.left.unit).toBe('in');
  });

  it('places a horizontal guide dragged off the top ruler, as one undo step on the scene', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const { guides, rulers, action } = fixture();
    const deps = { scene, view: { get: () => VIEW } } as unknown as ActionDeps;
    const d = drag(action('guide'), deps, 'top', screenToWorld(100, 10));
    expect(rulers.get().draft).toBeNull();
    d.move(screenToWorld(120, 80));
    expect(rulers.get().draft).toEqual({ id: 'g1', axis: 'y', offset: 60 });
    d.end(screenToWorld(120, 90));
    expect(rulers.get().draft).toBeNull();
    expect(guides.list).toEqual([{ id: 'g1', axis: 'y', offset: 70 }]);
    scene.undo();
    expect(guides.list).toEqual([]);
    scene.redo();
    expect(guides.list).toEqual([{ id: 'g1', axis: 'y', offset: 70 }]);
  });

  it('places a vertical guide off the left ruler through the commit hook', () => {
    const { guides, action } = fixture();
    const applyOps = vi.fn((ops: { apply(a: unknown): void }[]) => { for (const op of ops) op.apply(undefined); });
    const d = drag(action('guide'), { applyOps, view: { get: () => VIEW } } as unknown as ActionDeps, 'left', screenToWorld(10, 100));
    d.end(screenToWorld(150, 100));
    expect(applyOps).toHaveBeenCalledWith([expect.objectContaining({ label: 'Add Guide' })], 'Add Guide');
    expect(guides.list).toEqual([{ id: 'g1', axis: 'x', offset: 130 }]);
  });

  it('places nothing when released back over its ruler, or canceled', () => {
    const { guides, action } = fixture();
    const deps = { view: { get: () => VIEW } } as unknown as ActionDeps;
    const back = drag(action('guide'), deps, 'top', screenToWorld(100, 10));
    back.move(screenToWorld(100, 80));
    back.end(screenToWorld(100, 5));
    const canceled = drag(action('guide'), deps, 'top', screenToWorld(100, 10));
    canceled.end(screenToWorld(100, 80), 'cancel');
    expect(guides.list).toEqual([]);
  });

  it('claims a press near a placed guide, off the rulers', () => {
    const { guides, layers } = fixture();
    guides.addGuide({ id: 'h', axis: 'y', offset: 100 });
    const hit = layers.find((l) => l.id === 'rulers-hit')!;
    const at = (x: number, y: number) => {
      const w = screenToWorld(x, y);
      return (hit.hitTest!(w.x, w.y, undefined, VIEW, { width: 400, height: 300 }) as { initialScratch?: unknown } | null)?.initialScratch ?? null;
    };
    // World y 100 is screen y 120.
    expect(at(200, 123)).toEqual({ part: 'guide', guide: { id: 'h', axis: 'y', offset: 100 } });
    expect(at(200, 130)).toBeNull();
  });

  it('moves a placed guide, and removes one dropped on a ruler, each one undo step', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const { guides, rulers, action } = fixture();
    const placed: Guide = { id: 'v', axis: 'x', offset: 100 };
    guides.addGuide(placed);
    const deps = { scene, view: { get: () => VIEW } } as unknown as ActionDeps;
    const grab = (from: { x: number; y: number }) => {
      const at = (p: { x: number; y: number }): InvocationCtx => ({
        world: p, modifiers: MODS, deps,
        drag: { start: from, current: p, delta: { x: 0, y: 0 }, affordance: { payload: { part: 'guide', guide: guides.list[0] } } as never },
      });
      const handle = (action('guide').invoker as OngoingInvoker).start(at(from));
      return { move: (p: { x: number; y: number }) => handle.onMove?.(at(p)), end: (p: { x: number; y: number }) => handle.onEnd?.(at(p), 'commit') };
    };
    const move = grab({ x: 100, y: 50 });
    move.move({ x: 140, y: 50 });
    expect(rulers.get().draft).toEqual({ id: 'v', axis: 'x', offset: 140 });
    expect(rulers.settled(guides.list)).toEqual([]);
    move.end({ x: 150, y: 50 });
    expect(guides.list).toEqual([{ id: 'v', axis: 'x', offset: 150 }]);
    expect(rulers.settled(guides.list)).toBe(guides.list);
    scene.undo();
    expect(guides.list).toEqual([placed]);
    scene.redo();
    // Back onto the top ruler: screen y 5.
    grab({ x: 150, y: 50 }).end(screenToWorld(170, 5));
    expect(guides.list).toEqual([]);
    scene.undo();
    expect(guides.list).toEqual([{ id: 'v', axis: 'x', offset: 150 }]);
  });

  it('lands the guide where the snap dep puts it', () => {
    const { guides, action } = fixture();
    const end = vi.fn();
    const snap = { begin: () => ({ at: (p: { x: number; y: number }) => ({ point: { x: p.x, y: Math.round(p.y / 50) * 50 } }), end }) };
    const d = drag(action('guide'), { snap, view: { get: () => VIEW } } as unknown as ActionDeps, 'top', screenToWorld(100, 10));
    d.end(screenToWorld(100, 88));
    expect(guides.list).toEqual([{ id: 'g1', axis: 'y', offset: 50 }]);
    expect(end).toHaveBeenCalled();
  });

  it('reads the frame under the pointer, and the document once it leaves', () => {
    const scene = createScene<object, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      initial: [{ id: asNodeId('part'), kind: 'group', layer: 'main', parent: null, units: MM, pose: { x: 100, y: 50, width: 200, height: 100 }, data: {} }],
    });
    const { rulers, action } = fixture();
    const run = (action('pointer').invoker as ImmediateInvoker).run;
    run({ scene } as unknown as ActionDeps, { world: { x: 150, y: 80 }, over: true } as never);
    expect(rulers.get()).toMatchObject({ pointer: { x: 150, y: 80 }, frame: { id: 'part', scopes: [PT, MM], origin: { x: 100, y: 50 } } });
    expect(rulers.layout()!.top.unit).toMatch(/^(mm|cm)$/);
    run({ scene } as unknown as ActionDeps, { over: false } as never);
    expect(rulers.get()).toMatchObject({ pointer: null, frame: { id: null, scopes: [PT] } });
  });

  it('repaints the canvas for the guide being placed, not for every pointer move', () => {
    const { layers, action } = fixture();
    const draft = layers.find((l) => l.id === 'rulers-draft')!;
    const repaint = vi.fn();
    draft.subscribe!(repaint);
    (action('pointer').invoker as ImmediateInvoker).run({} as ActionDeps, { world: { x: 1, y: 1 }, over: true } as never);
    expect(repaint).not.toHaveBeenCalled();
    drag(action('guide'), { view: { get: () => VIEW } } as unknown as ActionDeps, 'top', screenToWorld(100, 10)).move(screenToWorld(100, 80));
    expect(repaint).toHaveBeenCalledTimes(1);
  });
});
