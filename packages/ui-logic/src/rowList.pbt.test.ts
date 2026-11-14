/**
 * Property tests of row lists: measured rows stack a gap apart inside the box, each row's parts sit inside it in
 * order, and `rowAtY` finds the row under a point and none between rows.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { type MeasureEnv } from './measure';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { ROW_GAP, listMode, measureRowList, rowAtY } from './rowList';

const RUNS = 300;
const TOKENS: Record<string, string> = {
  '--wzl-control-h': '24px', '--wzl-space-4': '8px', '--wzl-space-6': '12px', '--wzl-font-size-sm': '10px', '--wzl-leading-snug': '1.3',
};
const env: MeasureEnv = { token: (n) => TOKENS[n], text: (t) => ({ width: t.length * 5, ascent: 10, descent: 3 }) };

const width = fc.option(fc.integer({ min: 0, max: 60 }), { nil: undefined });
const face = fc.record({
  rows: fc.array(fc.record({ id: fc.string({ maxLength: 3 }), label: fc.string({ maxLength: 30 }), leadingWidth: width, trailingWidth: width }), { maxLength: 6 }),
  empty: fc.option(fc.string({ maxLength: 10 }), { nil: undefined }),
});
const constraints = fc.tuple(fc.integer({ min: 0, max: 300 }), fc.option(fc.integer({ min: 0, max: 300 }), { nil: Infinity }), fc.integer({ min: 0, max: 200 }), fc.option(fc.integer({ min: 0, max: 200 }), { nil: Infinity }))
  .map(([w, W, h, H]) => ({ minWidth: Math.min(w, W), maxWidth: Math.max(w, W), minHeight: Math.min(h, H), maxHeight: Math.max(h, H) }));

describe('measureRowList', () => {
  it('stacks rows a gap apart inside the box, each row\'s parts in order inside it', () => {
    const t = tally();
    fc.assert(fc.property(face, constraints, (f, c) => {
      const m = measureRowList(f, c, env);
      expect(m.width).toBeGreaterThanOrEqual(c.minWidth);
      expect(m.width).toBeLessThanOrEqual(c.maxWidth);
      expect(m.height).toBeGreaterThanOrEqual(c.minHeight);
      expect(m.height).toBeLessThanOrEqual(c.maxHeight);
      expect(Number.isFinite(m.width) && Number.isFinite(m.height) && Number.isFinite(m.baseline)).toBe(true);
      const { rows, empty } = m.layout;
      expect(rows.map((r) => r.id)).toEqual(f.rows.map((r) => r.id));
      if (f.rows.length === 0) { expect(empty).toBeDefined(); t.count('empty'); return; }
      rows.forEach((r, i) => {
        expect(r.rect).toEqual({ x: 0, y: i * (24 + ROW_GAP), width: m.width, height: 24 });
        expect(r.label.width).toBeGreaterThanOrEqual(0);
        expect(r.label.y).toBeGreaterThanOrEqual(r.rect.y);
        expect(r.label.y + r.label.height).toBeLessThanOrEqual(r.rect.y + r.rect.height);
        if (r.leading) expect(r.leading.x + r.leading.width).toBeLessThanOrEqual(r.label.x);
        if (r.trailing && r.label.width > 0) expect(r.label.x + r.label.width).toBeLessThanOrEqual(r.trailing.x);
        // Held to its width, a row's parts still fit when the list is as wide as its widest row.
        if (c.maxWidth === Infinity) {
          expect(r.label.width).toBeGreaterThanOrEqual(f.rows[i]!.label.length * 5);
          if (r.trailing) expect(r.trailing.x + r.trailing.width).toBeLessThanOrEqual(m.width);
          t.count('fits');
        }
        const mid = r.rect.y + r.rect.height / 2;
        expect(rowAtY(m.layout, mid)).toBe(i);
        if (i > 0) expect(rowAtY(m.layout, r.rect.y - ROW_GAP / 2)).toBeNull();
      });
      expect(rowAtY(m.layout, -1)).toBeNull();
      expect(rowAtY(m.layout, rows.length * (24 + ROW_GAP))).toBeNull();
      t.count('rows');
    }), runs(RUNS));
    t.atLeast('rows', RUNS / 2);
    t.atLeast('empty', RUNS / 20);
    t.atLeast('fits', RUNS / 4);
  }, timeoutFor(RUNS, 3));

  it('listMode is a grid for controls or activation alone, a listbox for selection, else a list', () => {
    fc.assert(fc.property(fc.record({ selection: fc.option(fc.constantFrom('single', 'multi' as const), { nil: undefined }), activatable: fc.boolean(), controls: fc.boolean() }), (o) => {
      expect(listMode(o)).toBe(o.controls || (o.activatable && !o.selection) ? 'grid' : o.selection ? 'listbox' : 'list');
    }), runs(RUNS));
  }, timeoutFor(RUNS, 3));
});
