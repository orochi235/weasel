import { describe, expect, it } from 'vitest';
import {
  createScene,
  createSnapOutcomeStore,
  type ActionDeps,
  type CanvasExtensionApi,
  type ContributionDepReader,
  type GestureContext,
  type NodeId,
  type RenderLayer,
  type SurfaceContribution,
} from '@weasel-js/core';
import { createSpacingHintsPreset, type SpacingHintsOptions } from './preset';

type Pose = { x: number; y: number; width: number; height: number };

function fixture(opts?: SpacingHintsOptions) {
  const scene = createScene<object, 'default', Pose>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
  const rect = (x: number) => scene.add({ kind: 'leaf', layer: 'default', pose: { x, y: 0, width: 10, height: 10 }, data: {} });
  const a = rect(0);
  const b = rect(30);
  const moving = rect(62);
  const preset = createSpacingHintsPreset(opts);
  const deps = { get: (name: string) => (name === 'scene' ? scene : name === 'selection' ? { get: () => [moving] } : undefined) };
  const contributions = (preset.contributions ?? []) as SurfaceContribution[];
  for (const c of contributions) c.attach?.({} as CanvasExtensionApi, deps as unknown as ContributionDepReader);
  const marks = contributions.find((c) => c.id === 'spacingHints.marks')!;
  return { scene, a, b, moving, preset, contributions, layer: marks.overlay as RenderLayer<unknown> };
}

const drag = (id: NodeId, origin: Pose): GestureContext<unknown> => ({
  draggedIds: [id],
  origin: new Map([[id, origin]]),
  current: new Map(),
  snap: null,
  modifiers: { alt: false, shift: false, meta: false, ctrl: false },
  pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
  view: null,
  adapter: {} as never,
  scratch: {},
});

const labels = (layer: RenderLayer<unknown>) =>
  layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } } as never, { width: 200, height: 100 })
    .filter((c) => c.kind === 'text');

describe('createSpacingHintsPreset', () => {
  it('snaps a moved shape to the spacing between its siblings and marks the equal gaps', () => {
    const { scene, moving, preset, layer } = fixture();
    const [move] = preset.moveBehaviors!;
    const res = move.onMove!(drag(moving, scene.get(moving)!.pose), { kind: 'translate', dx: 0, dy: 0 });
    // Its gap to the middle shape is 22; the gap beside it is 20, within the snap.
    expect(res).toEqual({ transform: { kind: 'translate', dx: -2, dy: 0 } });
    expect(labels(layer)).toHaveLength(2);
    move.onEnd!(drag(moving, scene.get(moving)!.pose), true as never);
    expect(labels(layer)).toHaveLength(0);
  });

  it('brings the Alt-hover distance readout unless told not to', () => {
    expect(fixture().contributions.map((c) => c.id)).toEqual(['spacingHints.marks', 'distanceReadout']);
    expect(fixture({ readout: false }).contributions.map((c) => c.id)).toEqual(['spacingHints.marks']);
  });

  it('adds no move behavior with both snaps off', () => {
    expect(fixture({ spacing: false, align: false }).preset.moveBehaviors).toEqual([]);
  });

  it('colors the Alt-hover readout with its color', () => {
    const { contributions, scene, a, b } = fixture({ color: '#e0397f' });
    const readout = contributions.find((c) => c.id === 'distanceReadout')!;
    const store = createSnapOutcomeStore();
    const run = (readout.actions![0].invoker as { run: (d: ActionDeps, p: unknown) => void }).run;
    run({
      scene, snapReadout: { store }, selection: { get: () => [a] }, nodeAtPoint: () => b,
    } as unknown as ActionDeps, { show: true, worldX: 35, worldY: 5 });
    expect(store.get().length).toBeGreaterThan(0);
    expect(store.get().every((m) => m.color === '#e0397f')).toBe(true);
  });
});
