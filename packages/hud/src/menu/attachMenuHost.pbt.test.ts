/**
 * Stateful property test of a menu host drawn on a HUD: opens, reopens, and closes of the host interleaved with focus
 * moves, widgets added, hidden, and removed, and detaches, some of them made by a focus listener while the HUD is
 * reporting a change. After every step the HUD holds one focused menu widget exactly while the host has a menu open,
 * and a menu closed any way but by focus leaving it gives focus back to the widget that held it when it opened.
 */
import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { pref } from '@weasel-js/prefs';
import { createMenuHost, type MenuHost } from '@weasel-js/routing';
import { createHud } from '../hud';
import type { Widget } from '../widget';
import { attachMenuHost } from './attachMenuHost';
import { runs, tally, timeoutFor } from '../pbt.fixture';

const RUNS = 150;
const POOL = 4;
const immediate = { timing: 'immediate' as const, run: () => {} };

function makeHost(): MenuHost {
  const h = createMenuHost({
    actions: () => [{ id: 'cut', label: 'Cut', invoker: immediate }],
    depsFor: () => undefined, trigger: () => true, activeTool: () => null,
  });
  h.define({ id: 'row', menu: pref.group('', { cut: pref.action('cut') }) });
  return h;
}

type Plain = Widget & { hidden: boolean };
const plain = (i: number): Plain => ({
  id: `p${i}`, bounds: { x: 700, y: i * 30, w: 20, h: 20 }, hidden: false, focusable: true,
  draw: () => [], hitTest: () => false, onPointer: () => {}, dispose: () => {},
});

type Cmd =
  | { t: 'open'; x: number; y: number }
  | { t: 'close' }
  | { t: 'focus'; i: number | null; visible: boolean }
  | { t: 'add' | 'remove'; i: number }
  | { t: 'hide'; i: number; hidden: boolean }
  | { t: 'tab' }
  | { t: 'reattach' }
  /** From now on, focusing widget `i` opens a menu from inside the focus report. */
  | { t: 'opener'; i: number | null };

const cmd: fc.Arbitrary<Cmd> = fc.oneof(
  { arbitrary: fc.record({ t: fc.constant('open' as const), x: fc.integer({ min: 0, max: 790 }), y: fc.integer({ min: 0, max: 590 }) }), weight: 3 },
  { arbitrary: fc.constant({ t: 'close' as const }), weight: 2 },
  { arbitrary: fc.record({ t: fc.constant('focus' as const), i: fc.option(fc.nat({ max: POOL - 1 }), { nil: null }), visible: fc.boolean() }), weight: 3 },
  fc.record({ t: fc.constantFrom('add' as const, 'remove' as const), i: fc.nat({ max: POOL - 1 }) }),
  fc.record({ t: fc.constant('hide' as const), i: fc.nat({ max: POOL - 1 }), hidden: fc.boolean() }),
  fc.constant({ t: 'tab' as const }),
  fc.constant({ t: 'reattach' as const }),
  fc.record({ t: fc.constant('opener' as const), i: fc.option(fc.nat({ max: POOL - 1 }), { nil: null }) }),
);

const opts = { toCanvas: (p: { x: number; y: number }) => p, canvasSize: () => ({ width: 800, height: 600 }), measure: () => 40 };

describe('attachMenuHost', () => {
  it('holds one focused menu widget exactly while the host has a menu open, and gives focus back on a close', () => {
    const seen = tally();
    fc.assert(fc.property(fc.array(cmd, { maxLength: 40 }), (cmds) => {
      const hud = createHud();
      const host = makeHost();
      const pool = Array.from({ length: POOL }, (_, i) => plain(i));
      for (const w of pool) hud.add(w);
      let detach = attachMenuHost(hud, host, opts);
      let opener: number | null = null;
      hud.subscribeFocus((f) => {
        if (opener !== null && f === pool[opener]) { seen.hit('opened mid-report'); host.open({ menu: 'row', client: { x: 5, y: 5 } }); }
      });
      const menus = () => hud.widgets().filter((w) => !pool.includes(w as Plain));
      /** The plain widget focused when the open menu opened, read off the HUD before each open. */
      let returnTo: Widget | null = null;
      let returnVisible = false;
      for (const c of cmds) {
        const wasOpen = host.current() !== null;
        const focusedBefore = hud.focused;
        const visibleBefore = hud.focusVisible;
        if (c.t === 'open') host.open({ menu: 'row', client: { x: c.x, y: c.y } });
        else if (c.t === 'close') host.close();
        else if (c.t === 'focus') hud.focus(c.i === null ? null : pool[c.i]!, { visible: c.visible });
        else if (c.t === 'add') hud.add(pool[c.i]!);
        else if (c.t === 'remove') hud.remove(pool[c.i]!);
        else if (c.t === 'hide') pool[c.i]!.hidden = c.hidden;
        else if (c.t === 'tab') hud.moveFocus('next');
        else if (c.t === 'reattach') { detach(); detach = attachMenuHost(hud, host, opts); }
        else opener = c.i;

        if (!wasOpen && host.current() !== null && c.t === 'open') { returnTo = focusedBefore; returnVisible = visibleBefore; }
        const open = host.current() !== null;
        const ms = menus();
        expect(ms).toHaveLength(open ? 1 : 0);
        if (open) {
          expect(hud.focused).toBe(ms[0]);
          seen.hit('open');
        }
        if (wasOpen && !open && c.t === 'close') {
          // Given back when it can still take focus; otherwise nothing holds it.
          const back = returnTo !== null && hud.widgets().includes(returnTo) && !(returnTo as Plain).hidden;
          if (opener === null) {
            expect(hud.focused).toBe(back ? returnTo : null);
            if (back) { expect(hud.focusVisible).toBe(returnVisible); seen.hit('given back'); }
          }
        }
        if (!open) returnTo = null;
      }
      detach();
      expect(menus()).toHaveLength(0);
    }), runs(RUNS));
    seen.atLeast('open', 100);
    seen.atLeast('given back', 5);
    seen.atLeast('opened mid-report', 5);
  }, timeoutFor(RUNS, 30));

  it('closes the menu when focus moves to anything else, and leaves focus there', () => {
    fc.assert(fc.property(fc.nat({ max: POOL - 1 }), fc.boolean(), (i, viaTab) => {
      const hud = createHud();
      const host = makeHost();
      const pool = Array.from({ length: POOL }, (_, k) => plain(k));
      for (const w of pool) hud.add(w);
      const detach = attachMenuHost(hud, host, opts);
      host.open({ menu: 'row', client: { x: 10, y: 10 } });
      const close = vi.spyOn(host, 'close');
      if (viaTab) hud.moveFocus('prev'); else hud.focus(pool[i]!);
      expect(close).toHaveBeenCalled();
      expect(host.current()).toBeNull();
      expect(pool).toContain(hud.focused);
      detach();
    }), runs(RUNS));
  });
});
