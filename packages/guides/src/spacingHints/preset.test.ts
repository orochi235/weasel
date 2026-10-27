import { describe, expect, it } from 'vitest';
import {
  createScene,
  createSnapOutcomeStore,
  type ActionDeps,
  type Scene,
  type SurfaceContribution,
} from '@weasel-js/core';
import { createSpacingHintsPreset, type SpacingHintsOptions } from './preset';
import { expectNear, moveBy } from '../sources/testing/session';

type Pose = { x: number; y: number; width: number; height: number };

function fixture(opts?: SpacingHintsOptions) {
  const scene = createScene<object, 'default', Pose>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
  const rect = (x: number) => scene.add({ kind: 'mark', layer: 'default', pose: { x, y: 0, width: 10, height: 10 }, data: {} });
  const a = rect(0);
  const b = rect(30);
  const moving = rect(62);
  const preset = createSpacingHintsPreset(opts);
  const contributions = (preset.contributions ?? []) as SurfaceContribution[];
  return { scene, a, b, moving, preset, contributions };
}

describe('createSpacingHintsPreset', () => {
  it('snaps a moved shape to the spacing between its siblings and marks the equal gaps in its color', () => {
    const { scene, moving, preset } = fixture({ color: '#e0397f' });
    const out = moveBy({
      sources: preset.snapSources!, ids: [moving], scene: scene as unknown as Scene<unknown, string, unknown>,
    }).by(0, 0);
    // Its gap to the middle shape is 22; the gap beside it is 20, within reach.
    expectNear(out.point, { x: -2, y: 0 });
    expect(out.marks.map((m) => [m.kind, m.color])).toEqual([['gap', '#e0397f'], ['gap', '#e0397f']]);
  });

  it('brings spacing by default, alignment when asked, and neither when both are off', () => {
    expect(fixture().preset.snapSources!.map((s) => s.id)).toEqual(['spacing']);
    expect(fixture({ align: true }).preset.snapSources!.map((s) => s.id)).toEqual(['spacing', 'alignment']);
    expect(fixture({ spacing: false, align: false }).preset.snapSources).toEqual([]);
    expect(fixture().preset.moveBehaviors).toBeUndefined();
  });

  it('gives its sources its tolerance as their reach', () => {
    expect(fixture({ align: true, tolerance: 12 }).preset.snapSources!.map((s) => s.reachPx)).toEqual([12, 12]);
    expect(fixture().preset.snapSources![0].reachPx).toBeUndefined();
  });

  it('brings the Alt-hover distance readout unless told not to', () => {
    expect(fixture().contributions.map((c) => c.id)).toEqual(['distanceReadout']);
    expect(fixture({ readout: false }).contributions).toEqual([]);
  });

  it('colors the Alt-hover readout with its color', () => {
    const { contributions, scene, a, b } = fixture({ color: '#e0397f' });
    const readout = contributions.find((c) => c.id === 'distanceReadout')!;
    const store = createSnapOutcomeStore();
    const run = (readout.actions![0].invoker as { run: (d: ActionDeps, p: unknown) => void }).run;
    run({
      scene, snapReadout: { store }, selection: { get: () => [a] }, nodeAtPoint: () => b,
    } as unknown as ActionDeps, { show: true, world: { x: 35, y: 5 } });
    expect(store.get().length).toBeGreaterThan(0);
    expect(store.get().every((m) => m.color === '#e0397f')).toBe(true);
  });

  it('gives its filter to both sources', () => {
    const { scene, moving, preset } = fixture({ align: true, filter: () => false });
    const out = moveBy({
      sources: preset.snapSources!, ids: [moving], scene: scene as unknown as Scene<unknown, string, unknown>,
    }).by(0, 0);
    expect(out).toMatchObject({ point: { x: 0, y: 0 }, marks: [] });
  });
});
