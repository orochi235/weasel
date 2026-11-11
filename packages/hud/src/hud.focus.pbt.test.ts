/**
 * Property test of a HUD's focus reports under listeners that move focus while it is reporting: every listener's
 * last report names the widget focused once the change settles, so a listener heard after one that moved focus on
 * never acts on the focus it moved past.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createHud } from './hud';
import type { Widget } from './widget';
import { runs, tally } from './pbt.fixture';

const POOL = 4;
const plain = (i: number): Widget => ({
  id: `p${i}`, bounds: { x: 0, y: i * 10, w: 10, h: 10 }, hidden: false, focusable: true,
  draw: () => [], hitTest: () => false, onPointer: () => {}, dispose: () => {},
});

describe('Hud focus reports', () => {
  it("leaves every listener's last report naming the focused widget, through listeners that move focus mid-report", () => {
    const seen = tally();
    /** For each listener: on hearing widget `on`, focus `to` (null blurs), at most once a step. */
    const listener = fc.record({ on: fc.option(fc.nat({ max: POOL - 1 }), { nil: null }), to: fc.option(fc.nat({ max: POOL - 1 }), { nil: null }) });
    const step = fc.oneof(
      fc.record({ t: fc.constant('focus' as const), i: fc.option(fc.nat({ max: POOL - 1 }), { nil: null }) }),
      fc.record({ t: fc.constant('tab' as const), next: fc.boolean() }),
    );
    fc.assert(fc.property(fc.array(listener, { minLength: 1, maxLength: 5 }), fc.array(step, { minLength: 1, maxLength: 20 }), (ls, steps) => {
      const hud = createHud();
      const pool = Array.from({ length: POOL }, (_, i) => plain(i));
      for (const w of pool) hud.add(w);
      const last: (Widget | null | 'none')[] = ls.map(() => 'none');
      let moves = 0;
      ls.forEach((l, k) => hud.subscribeFocus((f) => {
        last[k] = f;
        const on = l.on === null ? null : pool[l.on]!;
        if (f === on && moves < 10) { moves++; seen.hit('moved mid-report'); hud.focus(l.to === null ? null : pool[l.to]!); }
      }));
      for (const s of steps) {
        moves = 0;
        const before = hud.focused;
        if (s.t === 'focus') hud.focus(s.i === null ? null : pool[s.i]!);
        else hud.moveFocus(s.next ? 'next' : 'prev');
        if (hud.focused !== before || last.some((x) => x !== 'none')) {
          for (const x of last) if (x !== 'none') expect(x).toBe(hud.focused);
        }
      }
    }), runs(300));
    seen.atLeast('moved mid-report', 30);
  });
});
