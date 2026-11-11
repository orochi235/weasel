/**
 * Property tests of the HUD list: a press lands on the row drawn under it, and random presses, hovers, keys, focus
 * changes, and row swaps leave the keyboard and pointer on rows that exist, activate only rows that exist, and show
 * assistive tech the rows drawn, in order, with the keyboard's row active.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import type { TextDrawCommand } from '@weasel-js/core/renderer';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import type { HudDrawCtx, HudKeyEvent } from '../../widget';
import type { HudListRow } from './drawList';
import { createList } from './list';

const RUNS = 150;
const tokens = resolveTheme(weaselTheme, { mode: 'dark' });
const ctx = { dims: { width: 400, height: 400 }, defaultFont: 'D', color: () => '#000000', tokens } as unknown as HudDrawCtx;

const rowsArb: fc.Arbitrary<HudListRow[]> = fc.array(fc.record({
  label: fc.string({ minLength: 1, maxLength: 12 }),
  selected: fc.option(fc.boolean(), { nil: undefined }),
  swatch: fc.option(fc.constant('#ff0000'), { nil: undefined }),
}), { maxLength: 8 }).map((rs) => rs.map((r, i) => {
  const out: Record<string, unknown> = { id: `r${i}`, label: r.label };
  if (r.selected !== undefined) out.selected = r.selected;
  if (r.swatch !== undefined) out.swatch = r.swatch;
  return out as unknown as HudListRow;
}));

const key = (k: string, shiftKey = false): HudKeyEvent => ({
  type: 'keydown', key: k, code: '', altKey: false, ctrlKey: false, metaKey: false, shiftKey, repeat: false, native: null,
});

describe('createList', () => {
  it('activates the row drawn under a press', () => {
    const seen = tally();
    fc.assert(fc.property(rowsArb.filter((r) => r.length > 0), fc.nat(), fc.integer({ min: -50, max: 50 }), fc.integer({ min: -50, max: 50 }),
      (rows, pick, x0, y0) => {
        const got: [string, number][] = [];
        const l = createList({ id: 'l', x: x0, y: y0, w: 200, rows, selection: 'single', onActivate: (id, i) => { got.push([id, i]); } });
        const texts = l.draw(ctx).filter((c): c is TextDrawCommand => c.kind === 'text');
        expect(texts).toHaveLength(rows.length);
        const i = pick % rows.length;
        const at = { x: texts[i]!.x + 1, y: texts[i]!.y + 1 };
        l.onPointer({ type: 'down', ...at, native: null });
        l.onPointer({ type: 'up', ...at, native: null });
        expect(got).toEqual([[`r${i}`, i]]);
        expect(l.active).toBe(i);
        seen.hit(i === rows.length - 1 ? 'last' : 'other');
      }), runs(RUNS));
    seen.atLeast('last', 20);
    seen.atLeast('other', 20);
  });

  it('keeps the keyboard and pointer on rows that exist through any input and row swaps', () => {
    const seen = tally();
    const op = fc.oneof(
      fc.record({ kind: fc.constant('down' as const), y: fc.integer({ min: -20, max: 300 }) }),
      fc.record({ kind: fc.constant('up' as const), y: fc.integer({ min: -20, max: 300 }) }),
      fc.record({ kind: fc.constant('hover' as const), y: fc.integer({ min: -20, max: 300 }) }),
      fc.record({ kind: fc.constant('press' as const), y: fc.integer({ min: 0, max: 150 }) }),
      fc.constant({ kind: 'leave' as const }),
      fc.constant({ kind: 'cancel' as const }),
      fc.record({ kind: fc.constant('key' as const), key: fc.constantFrom('ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' ', 'a', 'b', 'Tab', 'PageDown') }),
      fc.record({ kind: fc.constant('focus' as const), on: fc.boolean() }),
      fc.record({ kind: fc.constant('rows' as const), rows: rowsArb }),
    );
    fc.assert(fc.property(rowsArb, fc.constantFrom('single', 'multi', undefined), fc.oneof(fc.constant(true), fc.boolean()), fc.array(op, { maxLength: 30 }),
      (initial, selection, activates, ops) => {
        let rows = initial;
        const got: [string, number][] = [];
        const l = createList({
          id: 'l', x: 0, y: 0, w: 200, rows, ...(selection ? { selection } : {}),
          ...(activates ? { onActivate: (id: string, i: number) => { got.push([id, i]); } } : {}),
        });
        for (const o of ops) {
          if (o.kind === 'down' || o.kind === 'up') l.onPointer({ type: o.kind, x: 10, y: o.y, native: null });
          else if (o.kind === 'press') {
            l.onPointer({ type: 'down', x: 10, y: o.y, native: null });
            l.onPointer({ type: 'up', x: 10, y: o.y, native: null });
          } else if (o.kind === 'hover') l.onPointer({ type: 'hovermove', x: 10, y: o.y, native: null });
          else if (o.kind === 'leave') l.onPointer({ type: 'hoverleave', native: null });
          else if (o.kind === 'cancel') l.onPointer({ type: 'cancel', native: null });
          else if (o.kind === 'key') l.onKey?.(key(o.key));
          else if (o.kind === 'focus') l.onFocusChange?.(o.on);
          else { rows = o.rows; l.setRows(rows); seen.hit('swap'); }
          const n = rows.length;
          if (l.active !== null) { expect(l.active).toBeGreaterThanOrEqual(0); expect(l.active).toBeLessThan(n); seen.hit('active'); }
          for (const [id, i] of got) { expect(i).toBeGreaterThanOrEqual(0); expect(id).toBe(`r${i}`); }
          if (got.length) seen.hit('activated');
          got.length = 0;
          const tree = l.accessibleTree!.read();
          expect(tree.children!.map((c) => c.label)).toEqual(rows.map((r) => r.label));
          const actives = tree.children!.flatMap((c, i) => (c.active ? [i] : []));
          expect(actives).toEqual(l.active === null ? [] : [l.active]);
          expect(l.draw(ctx).length).toBeGreaterThan(0);
        }
      }), runs(RUNS));
    seen.atLeast('swap', 20);
    seen.atLeast('active', 20);
    seen.atLeast('activated', 6);
  }, timeoutFor(RUNS, 30));
});
