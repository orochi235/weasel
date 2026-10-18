import { describe, expect, it } from 'vitest';
import { createScene, type Bounds, type Scene, type SnapMark } from '@weasel-js/core';
import { alignmentSnapSource } from './alignment';
import { spacingSnapSource } from './spacing';
import { drive, expectNear, moveBy } from './testing/session';

type Gap = Extract<SnapMark, { kind: 'gap' }>;
const gaps = (marks: readonly SnapMark[]) =>
  marks.filter((m): m is Gap => m.kind === 'gap').map((g) => [g.from.x, g.to.x, g.value]);

// A 0..20 and B 40..60 share the dragged box's row (y 100..150): a 20 gap.
const ROW: Bounds[] = [
  { x: 0, y: 100, width: 20, height: 50 },
  { x: 40, y: 100, width: 20, height: 50 },
];
const BOX: Bounds = { x: 100, y: 100, width: 50, height: 50 };
const row = (targets: readonly Bounds[] = ROW) => spacingSnapSource({ getTargets: () => targets, color: '#e0397f' });

describe('spacingSnapSource', () => {
  it('matches the box probes of a move or a resize', () => {
    expect(spacingSnapSource()).toMatchObject({ id: 'spacing', roles: ['box'], gestures: ['move', 'resize'] });
  });

  it('snaps the gap to the left neighbor to an existing gap, and marks every equal gap', () => {
    // A -18 drag puts the box at 82, 22 from B; 60 + 20 = 80.
    const out = moveBy({ sources: [row()], box: BOX }).by(-18, 0);
    expectNear(out.point, { x: -20, y: 0 });
    expect(gaps(out.marks)).toEqual([[20, 40, 20], [60, 80, 20]]);
    expect(out.marks.every((m) => m.color === '#e0397f')).toBe(true);
  });

  it('marks the gaps where the box lands, not where the drag put it', () => {
    const out = moveBy({ sources: [row()], box: BOX }).by(-18, 6);
    const own = out.marks.find((m): m is Gap => m.kind === 'gap' && m.from.x === 60)!;
    // The box sits at y 106..156 and B at 100..150, so the gap is drawn mid-overlap.
    expect(own.from.y).toBeCloseTo(128, 9);
  });

  it('centers the box between its two neighbors', () => {
    const pair: Bounds[] = [{ x: 0, y: 100, width: 20, height: 50 }, { x: 100, y: 100, width: 20, height: 50 }];
    const out = moveBy({ sources: [row(pair)], box: { x: 45, y: 100, width: 20, height: 50 } }).by(0, 0);
    expectNear(out.point, { x: 5, y: 0 });
    expect(gaps(out.marks)).toEqual([[20, 50, 30], [70, 100, 30]]);
  });

  it('leaves the box alone and marks nothing past reach', () => {
    const out = moveBy({ sources: [row()], box: BOX }).by(0, 0);
    expect(out).toMatchObject({ point: { x: 0, y: 0 }, held: false, marks: [] });
  });

  it('loses to a closer alignment line on the same axis', () => {
    const align = alignmentSnapSource({ getCandidates: () => [{ id: 'L', axis: 'x', offset: 81 }] });
    const out = moveBy({ sources: [row(), align], box: BOX }).by(-18, 0);
    expectNear(out.point, { x: -19, y: 0 });
    expect(gaps(out.marks)).toEqual([]);
  });

  it('is not offered a point gesture', () => {
    expectNear(drive({ sources: [row()] }).at({ x: 79, y: 120 }).point, { x: 79, y: 120 });
  });

  it('measures the subject\'s siblings in a scene', () => {
    const scene = createScene<object, 'default', Bounds>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
    const rect = (x: number) => scene.add({ kind: 'leaf', layer: 'default', pose: { x, y: 0, width: 10, height: 10 }, data: {} });
    rect(0);
    rect(30);
    const moving = rect(62);
    const out = moveBy({
      sources: [spacingSnapSource()], box: { x: 62, y: 0, width: 10, height: 10 },
      ids: [moving], scene: scene as unknown as Scene<unknown, string, unknown>,
    }).by(0, 0);
    // Its gap to the middle shape is 22; the gap beside it is 20, within reach.
    expectNear(out.point, { x: -2, y: 0 });
    expect(gaps(out.marks)).toEqual([[10, 30, 20], [40, 60, 20]]);
  });
});
