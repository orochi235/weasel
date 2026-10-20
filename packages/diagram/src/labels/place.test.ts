import { polylineFromPoints } from '@weasel-js/core/math';
import { describe, expect, it } from 'vitest';
import type { DiagramLabel } from '../labelTrait';
import { placeLabels, type PlaceLabel, type PlaceLabelsInput } from './place';
import { labelCenter } from './station';

const flat = (id: string, y = 0) => ({ id, points: [{ x: 0, y }, { x: 400, y }] });
const label = (edge: string, placement: DiagramLabel = { at: 'mid', offset: 9 }, extra: Partial<PlaceLabel> = {}): PlaceLabel =>
  ({ id: `${edge}/label`, edge, placement, size: { width: 40, height: 10 }, ...extra });

/** The box `label` takes on its route in `input`, at `spot` or else where it stands. */
function boxOf(input: PlaceLabelsInput, l: PlaceLabel, spot?: { at: number; offset: number } | null) {
  const route = input.routes.find((r) => r.id === l.edge)!;
  const placement = spot ? { ...l.placement, placed: spot } : l.placement;
  const c = labelCenter(polylineFromPoints([...route.points]), placement, l.size)!;
  return { x: c.x - 20, y: c.y - 5, width: 40, height: 10 };
}

const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('placeLabels', () => {
  it('keeps a clear preferred station', () => {
    const input = { shapes: [], routes: [flat('e')], labels: [label('e')] };
    expect(placeLabels(input)).toEqual(new Map([['e/label', null]]));
  });

  it('flips to the other side of the line when a shape covers it', () => {
    const input = { shapes: [{ id: 's', box: { x: 170, y: -30, width: 60, height: 25 } }], routes: [flat('e')], labels: [label('e')] };
    expect(placeLabels(input).get('e/label')).toEqual({ at: 0.5, offset: -9 });
  });

  it('slides along the line when shapes cover both sides', () => {
    const shapes = [
      { id: 'over', box: { x: 175, y: -30, width: 50, height: 25 } },
      { id: 'under', box: { x: 175, y: 5, width: 50, height: 25 } },
    ];
    const input = { shapes, routes: [flat('e')], labels: [label('e')] };
    const spot = placeLabels(input).get('e/label')!;
    expect(Math.abs(spot.at - 0.5)).toBeCloseTo(48 / 400, 9);
    for (const s of shapes) expect(overlap(boxOf(input, input.labels[0]!, spot), s.box)).toBe(false);
  });

  it('separates two labels on parallel connectors', () => {
    const input = {
      shapes: [],
      routes: [flat('a', 0), flat('b', 6)],
      labels: [label('b', { at: 'mid' }), label('a', { at: 'mid' })],
    };
    const out = placeLabels(input);
    expect(out.get('a/label')).toBeNull();
    const [a, b] = [input.labels[1]!, input.labels[0]!];
    expect(overlap(boxOf(input, a, out.get('a/label')), boxOf(input, b, out.get('b/label')))).toBe(false);
  });

  it('answers the same whatever order the labels come in', () => {
    const shapes = [{ id: 's', box: { x: 150, y: -40, width: 100, height: 80 } }];
    const routes = [flat('a', 0), flat('b', 6), flat('c', -6)];
    const labels = [label('a'), label('b'), label('c')];
    const one = placeLabels({ shapes, routes, labels });
    const two = placeLabels({ shapes, routes: [...routes].reverse(), labels: [...labels].reverse() });
    expect([...two].sort()).toEqual([...one].sort());
  });

  it('leaves a label that is not moving where it stands, and steers the moving ones off it', () => {
    const still = label('b', { at: 'mid' }, { moving: false });
    const input = { shapes: [], routes: [flat('a', 0), flat('b', 6)], labels: [label('a', { at: 'mid' }), still] };
    const out = placeLabels(input);
    expect(out.has('b/label')).toBe(false);
    expect(out.get('a/label')).not.toBeNull();
  });

  it('never moves a label that opts out', () => {
    const input = {
      shapes: [{ id: 's', box: { x: 170, y: -30, width: 60, height: 25 } }],
      routes: [flat('e')],
      labels: [label('e', { at: 'mid', offset: 9, dodge: false })],
    };
    expect(placeLabels(input).size).toBe(0);
  });

  it('starts from the point layout left room at', () => {
    const input = { shapes: [], routes: [flat('e')], labels: [label('e', { at: { near: { x: 100, y: -20 } }, offset: 9 })] };
    expect(placeLabels(input).get('e/label')).toBeNull();
    const blocked = { ...input, shapes: [{ id: 's', box: { x: 70, y: -30, width: 60, height: 25 } }] };
    expect(placeLabels(blocked).get('e/label')).toEqual({ at: 0.25, offset: -9 });
  });
});
