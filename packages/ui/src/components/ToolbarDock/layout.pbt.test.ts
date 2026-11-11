/**
 * Property tests of the toolbar dock's layout: `resolveLayout` places every bar it can once, where the bar may
 * sit, and is idempotent; `moveBar` puts one bar at its target and leaves every other where it was. Ids include
 * `Object.prototype`'s names.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { canEnter, dockRows, floatOf, moveBar, resolveLayout, type BarTarget, type DockBar, type DockSpec, type FloatPlace, type ToolbarLayout } from './layout';

const RUNS = 300;

const DOCK_IDS = ['top', 'side', 'constructor', '__proto__'];
const BAR_IDS = ['a', 'b', 'c', 'toString', '__proto__', 'hasOwnProperty'];

const docks: fc.Arbitrary<DockSpec[]> = fc.uniqueArray(fc.constantFrom(...DOCK_IDS), { minLength: 1, maxLength: 4 })
  .chain((ids) => fc.tuple(...ids.map((id) => fc.constantFrom('top', 'bottom', 'left', 'right' as const).map((edge) => ({ id, edge })))));

const bars: fc.Arbitrary<DockBar[]> = fc.uniqueArray(fc.constantFrom(...BAR_IDS), { maxLength: 6 }).chain((ids) => fc.tuple(...ids.map((id) => fc.record({
  id: fc.constant(id),
  label: fc.constant(id),
  docks: fc.uniqueArray(fc.constantFrom(...DOCK_IDS, 'gone'), { maxLength: 3 }),
  float: fc.boolean(),
  vertical: fc.boolean(),
  render: fc.constant(() => null),
}))));

const place: fc.Arbitrary<FloatPlace> = fc.record({
  x: fc.oneof(fc.integer({ min: -50, max: 500 }), fc.constantFrom(Number.NaN, Infinity)),
  y: fc.oneof(fc.integer({ min: -50, max: 500 }), fc.constant(Number.NaN)),
  anchor: fc.constantFrom('top-left', 'bottom-right', null, 'middle' as never),
  orientation: fc.constantFrom('horizontal', 'vertical' as const),
});

/** A stored layout, from another version of the app: any ids, rows, and floats. */
const stored: fc.Arbitrary<ToolbarLayout> = fc.record({
  docks: fc.dictionary(fc.constantFrom(...DOCK_IDS, 'gone'), fc.array(fc.array(fc.constantFrom(...BAR_IDS, 'old'), { maxLength: 3 }), { maxLength: 3 }), { noNullPrototype: true }),
  floating: fc.dictionary(fc.constantFrom(...BAR_IDS, 'old'), place, { noNullPrototype: true }),
});

/** Every bar a layout holds, with where. */
function placesOf(layout: ToolbarLayout): Array<{ id: string; dock: string | null }> {
  return [
    ...Object.keys(layout.docks).flatMap((dock) => dockRows(layout, dock)!.flat().map((id) => ({ id, dock }))),
    ...Object.keys(layout.floating).map((id) => ({ id, dock: null })),
  ];
}

describe('resolveLayout', () => {
  it('places each bar once where it may sit, keeps no empty row, and comes out as it went in', () => {
    const t = tally();
    fc.assert(fc.property(docks, bars, fc.option(stored, { nil: undefined }), (ds, bs, layout) => {
      const out = resolveLayout(ds, bs, layout);
      expect(Object.keys(out.docks).sort()).toEqual(ds.map((d) => d.id).sort());
      for (const d of ds) {
        const rows = dockRows(out, d.id);
        expect(Array.isArray(rows)).toBe(true);
        for (const row of rows!) expect(row.length).toBeGreaterThan(0);
      }
      const at = placesOf(out);
      expect(new Set(at.map((p) => p.id)).size).toBe(at.length);
      for (const p of at) {
        const bar = bs.find((b) => b.id === p.id)!;
        expect(bar).toBeDefined();
        if (p.dock === null) {
          expect(bar.float).toBe(true);
          const f = floatOf(out, p.id)!;
          expect(Number.isFinite(f.x) && Number.isFinite(f.y)).toBe(true);
          if (f.orientation === 'vertical') expect(bar.vertical).toBe(true);
          t.count('floats');
        } else {
          expect(canEnter(bar, ds.find((d) => d.id === p.dock)!)).toBe(true);
          t.count('docked');
        }
      }
      for (const b of bs) {
        const can = b.float || ds.some((d) => canEnter(b, d));
        expect(at.some((p) => p.id === b.id)).toBe(can);
        if (!can) t.count('nowhere');
      }
      expect(resolveLayout(ds, bs, out)).toEqual(out);
      if (ds.some((d) => d.id === '__proto__') && at.some((p) => p.dock === '__proto__')) t.count('proto dock');
    }), runs(RUNS));
    for (const k of ['floats', 'docked', 'nowhere', 'proto dock']) t.atLeast(k, 20);
  }, timeoutFor(RUNS, 3));
});

describe('moveBar', () => {
  it('puts the bar at its target alone, and leaves every other bar where it was, in its order', () => {
    const t = tally();
    const arb = fc.tuple(docks, bars, stored).map(([ds, bs, s]) => ({ ds, bs, layout: resolveLayout(ds, bs, s) }))
      .filter(({ layout }) => placesOf(layout).length > 0)
      .chain(({ ds, layout }) => fc.record({
        layout: fc.constant(layout),
        bar: fc.constantFrom(...placesOf(layout).map((p) => p.id)),
        to: fc.oneof(
          fc.record({ dock: fc.constantFrom(...ds.map((d) => d.id)), row: fc.integer({ min: -1, max: 4 }), index: fc.integer({ min: -1, max: 4 }), newRow: fc.boolean() }),
          place.map((p) => ({ float: { ...p, x: 0, y: 0 } })),
        ) as fc.Arbitrary<BarTarget>,
      }));
    fc.assert(fc.property(arb, ({ layout, bar, to }) => {
      const was = JSON.stringify(layout);
      const out = moveBar(layout, bar, to);
      expect(JSON.stringify(layout)).toBe(was);
      const at = placesOf(out);
      expect(at.filter((p) => p.id === bar)).toHaveLength(1);
      expect(at.find((p) => p.id === bar)!.dock).toBe('float' in to ? null : to.dock);
      for (const dock of Object.keys(out.docks)) for (const row of dockRows(out, dock)!) expect(row.length).toBeGreaterThan(0);
      const others = (l: ToolbarLayout) => placesOf(l).filter((p) => p.id !== bar);
      expect(others(out)).toEqual(others(layout));
      if (!('float' in to)) {
        t.count(to.newRow ? 'new row' : 'into row');
        const rows = dockRows(out, to.dock)!;
        if (to.newRow) expect(rows.find((r) => r.includes(bar))).toEqual([bar]);
      } else t.count('float');
    }), runs(RUNS));
    for (const k of ['new row', 'into row', 'float']) t.atLeast(k, 30);
  }, timeoutFor(RUNS, 3));
});

describe('layout, shrunk', () => {
  const bar = (id: string, more: Partial<DockBar> = {}): DockBar => ({ id, label: id, docks: [], render: () => null, ...more });

  it('floats a bar named `__proto__` as an own key', () => {
    const out = resolveLayout([{ id: 'top', edge: 'top' }], [bar('__proto__', { float: true })], undefined);
    expect(Object.keys(out.floating)).toEqual(['__proto__']);
    expect(Object.getPrototypeOf(out.floating)).toBe(Object.prototype);
    const moved = moveBar({ docks: { constructor: [], top: [['__proto__']] }, floating: {} }, '__proto__', { float: { x: 0, y: 0, anchor: 'top-left', orientation: 'horizontal' } });
    expect(floatOf(moved, '__proto__')).toEqual({ x: 0, y: 0, anchor: 'top-left', orientation: 'horizontal' });
  });

  it('moves a bar into an empty dock at row -1', () => {
    const out = moveBar({ docks: { top: [], side: [] }, floating: { b: { x: 0, y: 0, anchor: null, orientation: 'horizontal' } } }, 'b', { dock: 'top', row: -1, index: 0 });
    expect(out).toEqual({ docks: { top: [['b']], side: [] }, floating: {} });
  });
});
