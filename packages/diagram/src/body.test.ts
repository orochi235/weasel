import { describe, it, expect } from 'vitest';
import { bodyOutline, bodyTrait, buildBody, layoutBody, measureBody, sizeToBody } from './body';
import { outlinePath } from './outline';
import { portsOf } from './ports';
import type { BodySpec, MeasureRowText } from './body';
import type { Bounds } from './outline';

/** Every glyph 10 wide, every line 20 tall. Makes a floor arithmetic. */
const measure: MeasureRowText = (text) => ({ width: text.length * 10, height: 20 });

const spec = (rows: BodySpec['rows'], rest: Partial<BodySpec> = {}): BodySpec =>
  ({ outline: 'rect', rows, padding: 0, gap: 0, ...rest });

describe('measureBody', () => {
  it('is the widest row and the sum of the heights', () => {
    expect(measureBody(spec([
      { kind: 'label', text: 'abc' },
      { kind: 'label', text: 'abcdef' },
    ]), measure)).toEqual({ minWidth: 60, minHeight: 40 });
  });

  it('adds padding on both sides', () => {
    expect(measureBody(spec([{ kind: 'label', text: 'ab' }], { padding: 5 }), measure))
      .toEqual({ minWidth: 30, minHeight: 30 });
  });

  it('adds a gap between rows but not before the first', () => {
    expect(measureBody(spec([
      { kind: 'label', text: 'a' },
      { kind: 'label', text: 'a' },
    ], { gap: 6 }), measure).minHeight).toBe(46);
  });

  it('lays a field out on one line', () => {
    const floor = measureBody(spec([{ kind: 'field', label: 'ab', value: 'cd' }]), measure);
    expect(floor.minHeight).toBe(20);
    expect(floor.minWidth).toBeGreaterThan(40);
  });

  it('measures a slot at the height it declares', () => {
    expect(measureBody(spec([{ kind: 'slot', height: 33 }]), measure).minHeight).toBe(33);
  });

  it('grows the floor so a shape that does not fill its box still fits', () => {
    const rows: BodySpec['rows'] = [{ kind: 'label', text: 'abcdef' }];
    const rect = measureBody(spec(rows), measure);
    const diamond = measureBody(spec(rows, { outline: 'diamond' }), measure);
    expect(diamond.minWidth).toBe(rect.minWidth * 2);
    expect(diamond.minHeight).toBe(rect.minHeight * 2);
  });

  it('is empty for a body with no rows', () => {
    expect(measureBody(spec([]), measure)).toEqual({ minWidth: 0, minHeight: 0 });
  });

  it('gives a row real height with no measurer wired', () => {
    // The jsdom trap: a body that measures to zero renders as an empty page
    // with every test green.
    expect(measureBody(spec([{ kind: 'label', text: 'abc' }])).minHeight).toBeGreaterThan(0);
  });
});

describe('sizeToBody', () => {
  const floor = { minWidth: 100, minHeight: 40 };

  it('grows a pose too small for its body', () => {
    expect(sizeToBody({ x: 0, y: 0, width: 10, height: 10 }, floor))
      .toEqual({ x: 0, y: 0, width: 100, height: 40 });
  });

  it('leaves a bigger pose alone — the author set that', () => {
    const pose = { x: 0, y: 0, width: 300, height: 200 };
    expect(sizeToBody(pose, floor)).toBe(pose);
  });

  it('grows one axis without touching the other', () => {
    expect(sizeToBody({ x: 0, y: 0, width: 10, height: 200 }, floor))
      .toEqual({ x: 0, y: 0, width: 100, height: 200 });
  });

  it('keeps every other field on the pose', () => {
    expect(sizeToBody({ x: 5, y: 6, width: 1, height: 1, rotation: 0.5 }, floor))
      .toEqual({ x: 5, y: 6, width: 100, height: 40, rotation: 0.5 });
  });

  it('returns the same object when nothing changed, so a memo keyed on it holds', () => {
    const pose = { x: 0, y: 0, width: 100, height: 40 };
    expect(sizeToBody(pose, floor)).toBe(pose);
  });
});

describe('layoutBody', () => {
  const BOUNDS: Bounds = { x: 10, y: 20, width: 200, height: 100 };

  it('stacks rows from the top of the padded box', () => {
    const boxes = layoutBody(spec([
      { kind: 'label', text: 'a' },
      { kind: 'label', text: 'b' },
    ], { padding: 5, gap: 5 }), BOUNDS, measure);
    expect(boxes.map((b) => b.y)).toEqual([25, 50]);
    expect(boxes.map((b) => b.x)).toEqual([15, 15]);
  });

  it('gives every row the padded width', () => {
    const boxes = layoutBody(spec([{ kind: 'label', text: 'a' }], { padding: 5 }), BOUNDS, measure);
    expect(boxes[0]!.width).toBe(190);
  });

  it('leaves the slack at the bottom rather than distributing it', () => {
    const boxes = layoutBody(spec([{ kind: 'label', text: 'a' }]), BOUNDS, measure);
    expect(boxes[0]!.height).toBe(20);
  });

  it('carries each row and its index through', () => {
    const rows: BodySpec['rows'] = [{ kind: 'label', text: 'a' }, { kind: 'slot', height: 5 }];
    const boxes = layoutBody(spec(rows), BOUNDS, measure);
    expect(boxes.map((b) => b.index)).toEqual([0, 1]);
    expect(boxes[1]!.row).toBe(rows[1]);
  });

  it('insets rows to the shape, not to the bounding box', () => {
    // A diamond's inscribed rect is the middle quarter; a row placed against
    // the bounding box lands outside the diamond and the silhouette clips it
    // away, which reads as "the label vanished".
    const boxes = layoutBody(spec([{ kind: 'label', text: 'a' }], { outline: 'diamond' }),
      { x: 0, y: 0, width: 200, height: 100 }, measure);
    expect(boxes[0]!.x).toBe(50);
    expect(boxes[0]!.y).toBe(25);
    expect(boxes[0]!.width).toBe(100);
  });

  it('claims no width from a box narrower than its padding', () => {
    const boxes = layoutBody(spec([{ kind: 'label', text: 'a' }], { padding: 50 }),
      { x: 0, y: 0, width: 20, height: 20 }, measure);
    expect(boxes[0]!.width).toBe(0);
  });
});

describe('bodyTrait', () => {
  const BOUNDS: Bounds = { x: 0, y: 0, width: 100, height: 100 };

  it('gives a body with no port rows the four perimeter ports', () => {
    expect(bodyTrait(spec([{ kind: 'label', text: 'a' }]), BOUNDS, measure).ports!.map((p) => p.id))
      .toEqual(['n', 'e', 's', 'w']);
  });

  it('anchors a row port to its own row, on the side it was declared', () => {
    const trait = bodyTrait(spec([
      { kind: 'ports', left: [{ id: 'in' }], right: [{ id: 'out' }], height: 40 },
    ]), BOUNDS, measure);
    const inPort = trait.ports!.find((p) => p.id === 'in')!;
    const outPort = trait.ports!.find((p) => p.id === 'out')!;
    expect(inPort.at).toEqual({ u: 0, v: 0.2 });
    expect(outPort.at).toEqual({ u: 1, v: 0.2 });
  });

  it('normalizes the anchor, so resizing the node keeps the port on its row', () => {
    const rows: BodySpec['rows'] = [{ kind: 'ports', left: [{ id: 'in' }], height: 40 }];
    const small = bodyTrait(spec(rows), BOUNDS, measure).ports!.find((p) => p.id === 'in')!;
    const large = bodyTrait(spec(rows), { ...BOUNDS, width: 400 }, measure).ports!
      .find((p) => p.id === 'in')!;
    expect(large.at).toEqual(small.at);
  });

  // Both sit on the same edge, and a row near the vertical middle puts one
  // exactly on top of the other — where the later region wins the hit and the
  // first is grabbable nowhere.
  it('drops the compass port on whichever side a row port claims', () => {
    const both = bodyTrait(spec([
      { kind: 'ports', left: [{ id: 'in' }], right: [{ id: 'out' }], height: 40 },
    ]), BOUNDS, measure);
    expect(both.ports!.map((p) => p.id)).toEqual(['n', 's', 'in', 'out']);

    const rightOnly = bodyTrait(spec([
      { kind: 'ports', right: [{ id: 'out' }], height: 40 },
    ]), BOUNDS, measure);
    expect(rightOnly.ports!.map((p) => p.id)).toEqual(['n', 's', 'w', 'out']);
  });

  it('keeps all four when no row declares a port', () => {
    const trait = bodyTrait(spec([{ kind: 'label', text: 'plain' }]), BOUNDS, measure);
    expect(trait.ports!.map((p) => p.id)).toEqual(['n', 'e', 's', 'w']);
  });

  it('carries a row port type through', () => {
    const trait = bodyTrait(spec([{ kind: 'ports', left: [{ id: 'in', type: 'num' }] }]), BOUNDS, measure);
    expect(trait.ports!.find((p) => p.id === 'in')!.type).toBe('num');
  });

  it('falls back to the perimeter for a zero-height node', () => {
    const trait = bodyTrait(spec([{ kind: 'ports', left: [{ id: 'in' }] }]),
      { x: 0, y: 0, width: 100, height: 0 }, measure);
    expect(trait.ports!.map((p) => p.id)).toEqual(['n', 'e', 's', 'w']);
  });

  it('resolves through portsOf like any other trait', () => {
    const trait = bodyTrait(spec([{ kind: 'ports', left: [{ id: 'in' }], height: 40 }]), BOUNDS, measure);
    const ports = portsOf({ id: 'op', kind: 'container', data: { diagram: trait } }, BOUNDS);
    expect(ports.find((p) => p.id === 'in')!.point).toEqual({ x: 0, y: 20 });
  });
});

describe('bodyOutline', () => {
  it("is the path the spec's outline names", () => {
    const bounds: Bounds = { x: 0, y: 0, width: 10, height: 10 };
    expect(bodyOutline(spec([], { outline: 'diamond' }), bounds))
      .toEqual(outlinePath('diamond', bounds));
  });
});

describe('buildBody', () => {
  const at = { x: 10, y: 20, width: 40, height: 10 };
  const body = (rows: BodySpec['rows'] = [{ kind: 'label', text: 'step' }]) =>
    buildBody<{ text?: string }, 'main', typeof at>(spec(rows), at, {
      layer: 'main',
      id: 'step',
      measure,
      body: () => ({}),
      row: (text) => (text === '' ? null : { text }),
    });

  it('grows the authored pose to the floor its rows measure', () => {
    const { pose, specs } = body();
    expect(pose).toEqual({ x: 10, y: 20, width: 40, height: 20 });
    expect(specs[0]!.pose).toEqual(pose);
  });

  it('parents each row under the container, at the box `layoutBody` gives it', () => {
    const { pose, specs } = body();
    const boxes = layoutBody(spec([{ kind: 'label', text: 'step' }]), pose, measure);
    expect(specs[1]).toMatchObject({
      kind: 'leaf', parent: 'step', data: { text: 'step' },
      pose: { x: boxes[0]!.x, y: boxes[0]!.y, width: boxes[0]!.width, height: boxes[0]!.height },
    });
  });

  it('formats a field row as one string', () => {
    const { specs } = body([{ kind: 'field', label: 'by', value: '2.0' }]);
    expect(specs[1]!.data).toEqual({ text: 'by: 2.0' });
  });

  it('leaves out a row the consumer declines', () => {
    const { specs } = body([
      { kind: 'label', text: 'op' },
      { kind: 'ports', left: [{ id: 'in' }] },
    ]);
    expect(specs.map((n) => n.kind)).toEqual(['container', 'leaf']);
  });

  it('hands the container the trait its rows imply', () => {
    const specs = buildBody<{ diagram: unknown }, 'main', typeof at>(
      spec([{ kind: 'ports', left: [{ id: 'in' }], height: 40 }]), at,
      { layer: 'main', measure, body: (trait) => ({ diagram: trait }), row: () => null },
    ).specs;
    const trait = (specs[0]!.data as { diagram: { ports: { id: string }[] } }).diagram;
    expect(trait.ports.map((p) => p.id)).toEqual(['n', 'e', 's', 'in']);
  });
});
