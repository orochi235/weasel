import { describe, expect, it } from 'vitest';
import type { Bounds, SnapMark } from '@weasel-js/core';
import { alignmentSnapSource } from './alignment';
import { spacingSnapSource } from './spacing';
import { drive, expectNear, moveBy, sceneOf } from './testing/session';

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
    const rect = (x: number) => ({ x, y: 0, width: 10, height: 10 });
    const { scene, ids } = sceneOf([rect(0), rect(30), rect(62)]);
    const out = moveBy({ sources: [spacingSnapSource()], ids: [ids[2]], scene }).by(0, 0);
    // Its gap to the middle shape is 22; the gap beside it is 20, within reach.
    expectNear(out.point, { x: -2, y: 0 });
    expect(gaps(out.marks)).toEqual([[10, 30, 20], [40, 60, 20]]);
  });

  it('snaps a resize\'s moving edge so its gap to the next box equals an existing gap', () => {
    const { scene, ids } = sceneOf([BOX]);
    const targets = [...ROW, { x: 170, y: 100, width: 20, height: 50 }];
    const d = drive({
      sources: [row(targets)], gesture: 'resize', scene, ids, handle: { x: 'min', y: 'free' }, press: { x: 150, y: 125 },
    });
    // The east edge at 148; C starts at 170, so 170 - 20 = 150. The west edge stays.
    const out = d.at({ x: 148, y: 125 });
    expectNear(out.point, { x: 150, y: 125 });
    expect(gaps(out.marks)).toEqual([[20, 40, 20], [150, 170, 20]]);
  });

  it('leaves the pinned side of a resize where it is', () => {
    const { scene, ids } = sceneOf([BOX]);
    // Moved whole, the box would center at 101..189. Its east edge alone lands
    // at 190, where its gap to the box at 230 matches its 40 to B.
    const d = drive({
      sources: [row([ROW[1], { x: 230, y: 100, width: 20, height: 50 }])],
      gesture: 'resize', scene, ids, handle: { x: 'min', y: 'free' }, press: { x: 150, y: 125 },
    });
    expectNear(d.at({ x: 188, y: 125 }).point, { x: 190, y: 125 });
  });

  it('moves the side a resize has flipped onto once the drag crosses the pinned edge', () => {
    const { scene, ids } = sceneOf([{ x: 200, y: 100, width: 50, height: 50 }]);
    const d = drive({
      sources: [row()], gesture: 'resize', scene, ids, handle: { x: 'min', y: 'free' }, press: { x: 250, y: 125 },
    });
    // Dragged past 200, the east edge is the box's west side at 82: 22 from B,
    // and the 20 between A and B puts it at 80.
    expectNear(d.at({ x: 82, y: 125 }).point, { x: 80, y: 125 });
  });

  it('filter keeps a rejected sibling from offering gaps', () => {
    const { scene, ids } = sceneOf([
      BOX, { ...ROW[0], data: { skip: true } }, { ...ROW[1], data: { skip: true } },
    ]);
    const run = (filter?: (n: { data: unknown }) => boolean) =>
      moveBy({ sources: [spacingSnapSource({ ...(filter ? { filter } : {}) })], scene, ids: [ids[0]] }).by(-18, 0);
    expectNear(run().point, { x: -20, y: 0 });
    expect(run((n) => !(n.data as { skip?: boolean }).skip)).toMatchObject({ point: { x: -18, y: 0 }, marks: [] });
  });
});

