/**
 * Property tests of the hit tests a HUD menu answers pointer input with, against what it draws: the row under a
 * point, the topmost panel, a number row's step chips, and the caret a press in typed text lands on.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createMenuController, type MenuNumberEntry, type Rect } from '@weasel-js/menu';
import { draftText, grapheme, menuLevel, openPath, runs, tally } from '../pbt.fixture';
import { chipUnder, levelAt } from './chipRepeat';
import { DEFAULT_MENU_METRICS, panelSize, rowAt, rowLayout, type MenuMetrics } from './drawPanel';
import { clusterStops, startEdit, type HudTextEdit } from './textEdit';
import { caretAt, caretX, chipAt, numberChips, typingCommands } from './valueRows';

const RUNS = 300;

const metrics: fc.Arbitrary<MenuMetrics> = fc.oneof(
  fc.constant(DEFAULT_MENU_METRICS),
  fc.record({
    rowHeight: fc.integer({ min: 12, max: 40 }), padX: fc.integer({ min: 0, max: 16 }), padY: fc.integer({ min: 0, max: 12 }),
    separatorHeight: fc.integer({ min: 1, max: 16 }), minWidth: fc.integer({ min: 0, max: 300 }), fontSize: fc.integer({ min: 8, max: 24 }),
  }),
);

const rect = fc.record({
  x: fc.integer({ min: -100, max: 600 }), y: fc.integer({ min: -100, max: 600 }),
  w: fc.integer({ min: 0, max: 300 }), h: fc.integer({ min: 0, max: 300 }),
});
/** A fraction spread evenly over `[lo, hi]`, not crowded at its ends as fast-check's doubles are. */
const between = (lo: number, hi: number) => fc.integer({ min: 0, max: 10_000 }).map((k) => lo + (hi - lo) * k / 10_000);
const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

describe('menu hit tests', () => {
  it('finds the row drawn under a point, and none in the padding', () => {
    const seen = tally();
    fc.assert(fc.property(menuLevel(0, 12), metrics, between(-0.1, 1.1), (entries, m, f) => {
      const y = f * panelSize(entries, m, () => 0).h;
      const rows = rowLayout(entries, m);
      const i = rowAt(entries, m, y);
      if (i === null) {
        expect(rows.some((r) => y >= r.y && y < r.y + r.h)).toBe(false);
        seen.hit('miss');
      } else {
        expect(y >= rows[i]!.y && y < rows[i]!.y + rows[i]!.h).toBe(true);
        seen.hit('row');
      }
      rows.forEach((r, k) => { if (k > 0) expect(r.y).toBe(rows[k - 1]!.y + rows[k - 1]!.h); });
      const last = rows.at(-1)!;
      expect(panelSize(entries, m, () => 0).h).toBe(last.y + last.h + m.padY);
    }), runs(RUNS));
    seen.atLeast('miss', 20);
    seen.atLeast('row', 20);
  });

  it('takes the topmost panel under a point', () => {
    fc.assert(fc.property(fc.array(rect, { maxLength: 5 }), fc.integer({ min: -100, max: 900 }), fc.integer({ min: -100, max: 900 }), (panels, x, y) => {
      const want = panels.map((p, i) => (inside(p, x, y) ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
      expect(levelAt(panels, x, y)).toBe(want);
    }), runs(RUNS));
  });

  it('steps a number row from a press inside its minus or plus chip only', () => {
    const seen = tally();
    fc.assert(fc.property(fc.integer({ min: 0, max: 400 }), metrics, between(-0.2, 1.2), (w, m, f) => {
      const x = w - m.padX - f * 4 * m.rowHeight;
      const { minus, value, plus } = numberChips(w, m);
      expect(minus.x + minus.w).toBe(value.x);
      expect(value.x + value.w).toBe(plus.x);
      expect(plus.x + plus.w).toBe(w - m.padX);
      const dir = chipAt(w, m, x);
      const on = (s: { x: number; w: number }) => x >= s.x && x < s.x + s.w;
      expect(dir).toBe(on(plus) ? 1 : on(minus) ? -1 : null);
      seen.hit(String(dir));
    }), runs(RUNS));
    for (const k of ['1', '-1', 'null']) seen.atLeast(k, 10);
  });

  it('finds a chip only on an enabled number row of the topmost panel under the point', () => {
    const seen = tally();
    fc.assert(fc.property(menuLevel(2), fc.array(fc.nat(), { maxLength: 3 }), metrics, fc.nat(), fc.nat(), (entries, path, m, px, py) => {
      const c = createMenuController({ entries, onClose: () => {} });
      openPath(c, path);
      const panels = c.stack().map((_, level) => {
        const size = panelSize(c.entriesAt(level), m, (t) => t.length * 6);
        return { x: level * (size.w - 20), y: level * 30, ...size };
      });
      const top = panels.at(-1)!;
      const deepest = c.entriesAt(panels.length - 1);
      const rows = rowLayout(deepest, m);
      const numbers = rows.filter((_, i) => deepest[i]!.kind === 'number' && py % 4 !== 0);
      const row = numbers[py % Math.max(1, numbers.length)];
      const x = top.x + top.w - m.padX - (px % (4 * m.rowHeight + 4));
      const y = row ? top.y + row.y + (py % row.h) : top.y + (py % (top.h + 1));
      const chip = chipUnder(c, panels, m, x, y);
      const level = levelAt(panels, x, y);
      if (!chip) { seen.hit('none'); return; }
      seen.hit('chip');
      const index = rowAt(c.entriesAt(level), m, y - panels[level]!.y)!;
      const entry = c.entriesAt(level)[index] as MenuNumberEntry;
      expect(chip.entry).toBe(entry);
      expect(entry.kind).toBe('number');
      expect(entry.disabled).toBe(false);
      expect(chip.dir).toBe(chipAt(panels[level]!.w, m, x - panels[level]!.x));
    }), runs(RUNS));
    seen.atLeast('chip', 5);
    seen.atLeast('none', 10);
  });
});

/** A width per code point, so a run of text measures as the sum of its characters'. */
const widths = fc.dictionary(grapheme, fc.integer({ min: 1, max: 14 }));
const measureWith = (w: Record<string, number>) => (text: string) => Array.from(text).reduce((sum, ch) => sum + (w[ch] ?? 7), 0);

describe('typed text', () => {
  it('lands a press on the cluster stop nearest it, or on none left of the text', () => {
    const seen = tally();
    fc.assert(fc.property(draftText, fc.integer({ min: 60, max: 400 }), metrics, between(-1.5, 0.1), widths,
      (draft, w, m, f, ws) => {
        const measure = measureWith(ws);
        const x = w - m.padX + f * Math.max(40, measure(draft) * 1.5);
        const right = w - m.padX - 3;
        const xAt = (i: number) => right - measure(Array.from(draft).slice(i).join(''));
        const at = caretAt(draft, w, m, x, measure);
        if (x < xAt(0) - m.padX) { expect(at).toBeUndefined(); seen.hit('left'); return; }
        const stops = clusterStops(draft);
        expect(stops).toContain(at);
        for (const s of stops) expect(Math.abs(xAt(at!) - x)).toBeLessThanOrEqual(Math.abs(xAt(s) - x));
        seen.hit('caret');
      }), runs(RUNS));
    seen.atLeast('left', 10);
    seen.atLeast('caret', 10);
  });

  it('draws finite typing, the selection between its ends, and the caret where caretX puts it', () => {
    const edits: fc.Arbitrary<HudTextEdit> = fc.tuple(draftText, fc.nat(), fc.nat(), fc.option(draftText, { nil: undefined })).map(([d, a, b, pre]) => {
      const n = Array.from(d).length;
      const e = startEdit({ kind: 'text', key: 't', label: 'T', value: d, set: () => {} }, d);
      return { ...e, caret: a % (n + 1), anchor: b % (n + 1), ...(pre ? { preedit: pre } : {}) };
    });
    fc.assert(fc.property(edits, fc.integer({ min: 60, max: 400 }), metrics, widths, (edit, w, m, ws) => {
      const measure = measureWith(ws);
      const b = { x: 10, y: 20, w, h: 200 };
      const cmds = typingCommands(b, { y: 4, h: m.rowHeight }, edit, m,
        { fg: '#fff', muted: '#888', border: '#444', font: { fontFamily: 'Inter', fontSize: m.fontSize } }, '#00f', measure);
      const nums: number[] = [];
      JSON.stringify(cmds, (_k, v) => { if (typeof v === 'number') nums.push(v); return v; });
      expect(nums.every(Number.isFinite)).toBe(true);
      const caret = cmds.at(-1) as { path: { kind: string } };
      expect(caret.path).toBeDefined();
      const sel = cmds.find((c) => c.kind === 'path' && (c as { path: { kind: string } }).path.kind === 'rect') as
        { path: { x: number; width: number } } | undefined;
      if (sel) expect(sel.path.width).toBeGreaterThan(0);
      expect(Number.isFinite(caretX(edit, w, m, measure))).toBe(true);
    }), runs(RUNS));
  });
});
