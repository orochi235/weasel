/**
 * Stateful property tests of a HUD button: pointer, hover, and key sequences against a model of its press, checking
 * the events it reports, when its frame goes stale, and the fill it draws; and listeners that subscribe, unsubscribe,
 * throw, and dispose the button while it is reporting, which must leave its press and its frame agreeing.
 */
import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import type { PathDrawCommand } from '@weasel-js/core/renderer';
import { createButton, type ButtonEvent, type ButtonHandler } from './button';
import { runs, tally, timeoutFor } from '../pbt.fixture';

const RUNS = 200;
const tokens = resolveTheme(weaselTheme, { mode: 'dark' });
const ctx = { dims: { width: 400, height: 300 }, defaultFont: 'D', color: () => '#000000', tokens };
const FILL = '#111111', HOVER = '#222222', PRESSED = '#333333';

type Cmd =
  | { t: 'down' | 'move' | 'up' | 'hovermove'; x: number; y: number }
  | { t: 'cancel' | 'hoverleave' }
  | { t: 'key'; key: string; type: 'keydown' | 'keyup' }
  | { t: 'bounds'; x: number; y: number; w: number; h: number }
  | { t: 'hide'; hidden: boolean };

const pt = fc.integer({ min: -20, max: 140 });
const cmd: fc.Arbitrary<Cmd> = fc.oneof(
  fc.record({ t: fc.constantFrom('down' as const, 'move' as const, 'up' as const, 'hovermove' as const), x: pt, y: pt }),
  fc.record({ t: fc.constantFrom('cancel' as const, 'hoverleave' as const) }),
  fc.constant({ t: 'hoverleave' as const }),
  fc.record({ t: fc.constant('key' as const), key: fc.constantFrom('Enter', ' ', 'a', 'Escape'), type: fc.constantFrom('keydown' as const, 'keyup' as const) }),
  fc.record({ t: fc.constant('bounds' as const), x: pt, y: pt, w: fc.integer({ min: 1, max: 120 }), h: fc.integer({ min: 1, max: 60 }) }),
  fc.record({ t: fc.constant('hide' as const), hidden: fc.boolean() }),
);

interface Model { held: boolean; down: boolean; hovered: boolean; b: { x: number; y: number; w: number; h: number } }
const inside = (m: Model, x: number, y: number) => x >= m.b.x && x < m.b.x + m.b.w && y >= m.b.y && y < m.b.y + m.b.h;

/** The model's step: the events `c` reports, and whether what the button draws changed. */
function step(m: Model, c: Cmd): { events: ButtonEvent[]; stale: boolean } {
  const before = { held: m.held, hovered: m.hovered };
  const events: ButtonEvent[] = [];
  switch (c.t) {
    case 'down': m.held = true; m.down = true; break;
    case 'move': m.held = m.down && inside(m, c.x, c.y); break;
    case 'up': if (m.held && inside(m, c.x, c.y)) events.push('press'); m.held = false; m.down = false; break;
    case 'cancel': m.held = false; m.down = false; break;
    case 'hovermove': m.hovered = true; break;
    case 'hoverleave': m.hovered = false; break;
    case 'key': if (c.type === 'keydown' && (c.key === 'Enter' || c.key === ' ')) events.push('press'); break;
    case 'bounds': m.b = { x: c.x, y: c.y, w: c.w, h: c.h }; return { events, stale: true };
    case 'hide': return { events, stale: true };
  }
  if (m.hovered !== before.hovered) events.push(m.hovered ? 'hover' : 'leave');
  return { events, stale: m.held !== before.held || m.hovered !== before.hovered };
}

function apply(b: ReturnType<typeof createButton>, c: Cmd): void {
  switch (c.t) {
    case 'down': case 'move': case 'up': case 'hovermove': b.onPointer({ type: c.t, x: c.x, y: c.y, native: null }); break;
    case 'cancel': case 'hoverleave': b.onPointer({ type: c.t, native: null }); break;
    case 'key': b.onKey!({ type: c.type, key: c.key, code: '', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, native: null as never }); break;
    case 'bounds': b.setBounds({ x: c.x, y: c.y, w: c.w, h: c.h }); break;
    case 'hide': b.setHidden(c.hidden); break;
  }
}

const fillOf = (b: ReturnType<typeof createButton>) => ((b.draw(ctx)[0] as PathDrawCommand).fill!.paint as { color: string }).color;

describe('createButton', () => {
  it('reports presses, hovers, and leaves, and goes stale, as a model of its press does', () => {
    const seen = tally();
    fc.assert(fc.property(fc.array(cmd, { maxLength: 60 }), (cmds) => {
      const m: Model = { held: false, down: false, hovered: false, b: { x: 10, y: 10, w: 80, h: 24 } };
      const onChange = vi.fn();
      const b = createButton({ id: 'b', ...m.b, label: 'Go', fill: FILL, hoverFill: HOVER, pressedFill: PRESSED, onChange });
      const heard: ButtonEvent[] = [];
      for (const e of ['press', 'hover', 'leave'] as const) b.on(e, () => heard.push(e));
      for (const c of cmds) {
        const deps = b.deps!(ctx);
        const changes = onChange.mock.calls.length;
        const before = heard.length;
        const want = step(m, c);
        apply(b, c);
        expect(heard.slice(before)).toEqual(want.events);
        expect(b.deps!(ctx) !== deps).toBe(want.stale);
        expect(onChange.mock.calls.length - changes).toBe(want.stale ? 1 : 0);
        expect(fillOf(b)).toBe(m.held ? PRESSED : m.hovered ? HOVER : FILL);
        for (const e of want.events) seen.hit(e);
        if (want.stale) seen.hit('stale');
      }
    }), runs(RUNS));
    seen.atLeast('press', 20);
    seen.atLeast('hover', 20);
    seen.atLeast('leave', 20);
  }, timeoutFor(RUNS, 10));

  it('reports translated presses alike when the button and every point move together', () => {
    fc.assert(fc.property(fc.array(cmd, { maxLength: 40 }), pt, pt, (cmds, tx, ty) => {
      const run = (dx: number, dy: number) => {
        const b = createButton({ id: 'b', x: 10 + dx, y: 10 + dy, w: 80, h: 24, label: 'Go' });
        const heard: ButtonEvent[] = [];
        for (const e of ['press', 'hover', 'leave'] as const) b.on(e, () => heard.push(e));
        for (const c of cmds) apply(b, 'x' in c ? { ...c, x: c.x + dx, y: c.y + dy } : c);
        return heard;
      };
      expect(run(tx, ty)).toEqual(run(0, 0));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 10));

  /** A listener's act during a report. */
  type Act = { a: 'none' } | { a: 'off' | 'on' | 'reon'; i: number; e: ButtonEvent } | { a: 'throw' } | { a: 'dispose' };
  const EVENTS = ['press', 'hover', 'leave'] as const;
  const act: fc.Arbitrary<Act> = fc.oneof(
    { arbitrary: fc.constant({ a: 'none' as const }), weight: 3 },
    fc.record({ a: fc.constantFrom('off' as const, 'on' as const, 'reon' as const), i: fc.nat({ max: 3 }), e: fc.constantFrom(...EVENTS) }),
    fc.constant({ a: 'throw' as const }),
    fc.constant({ a: 'dispose' as const }),
  );

  /** Whether a listener that ran during the report took `i` off `e`, even to put it back. */
  const removedDuring = (acts: readonly Act[], got: readonly [number, ButtonEvent][], i: number, e: ButtonEvent) =>
    got.some(([j]) => { const x = acts[j]!; return (x.a === 'off' || x.a === 'reon') && x.i === i && x.e === e; });

  it('reports to the listeners held when the report began, through listeners acting mid-report, and keeps its frame current', () => {
    const seen = tally();
    const spec = fc.record({
      acts: fc.array(act, { minLength: 4, maxLength: 4 }),
      subs: fc.array(fc.tuple(fc.nat({ max: 3 }), fc.constantFrom(...EVENTS)), { minLength: 1, maxLength: 8 }),
      cmds: fc.array(cmd, { maxLength: 30 }),
    });
    fc.assert(fc.property(spec, ({ acts, subs, cmds }) => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const b = createButton({ id: 'b', x: 10, y: 10, w: 80, h: 24, label: 'Go', fill: FILL, hoverFill: HOVER, pressedFill: PRESSED });
        const held = EVENTS.map(() => new Set<number>());
        const calls: [number, ButtonEvent][] = [];
        let disposed = false;
        const handlers: ButtonHandler[][] = acts.map((_, i) => EVENTS.map((e) => () => {
          calls.push([i, e]);
          // A runaway report stops here rather than hanging the run.
          if (calls.length > 500) throw new Error('runaway');
          const x = acts[i]!;
          if (disposed) return;
          if (x.a === 'off') { b.off(x.e, handlers[x.i]![EVENTS.indexOf(x.e)]!); held[EVENTS.indexOf(x.e)]!.delete(x.i); }
          if (x.a === 'on') { b.on(x.e, handlers[x.i]![EVENTS.indexOf(x.e)]!); held[EVENTS.indexOf(x.e)]!.add(x.i); }
          if (x.a === 'reon') {
            const h = handlers[x.i]![EVENTS.indexOf(x.e)]!;
            b.off(x.e, h); b.on(x.e, h);
            held[EVENTS.indexOf(x.e)]!.add(x.i);
          }
          if (x.a === 'throw') { seen.hit('throw'); throw new Error('listener'); }
          if (x.a === 'dispose') { disposed = true; b.dispose(); }
        }));
        for (const [i, e] of subs) { b.on(e, handlers[i]![EVENTS.indexOf(e)]!); held[EVENTS.indexOf(e)]!.add(i); }
        const m: Model = { held: false, down: false, hovered: false, b: { x: 10, y: 10, w: 80, h: 24 } };
        for (const c of cmds) {
          if (disposed) break;
          const want = step(m, c);
          const before = calls.length;
          const deps = b.deps!(ctx);
          const kept = held.map((s) => new Set(s));
          apply(b, c);
          const got = calls.slice(before);
          for (const e of want.events) {
            const of = got.filter(([, g]) => g === e).map(([i]) => i);
            // Nobody hears one report twice, and a listener held from before it to after it heard it.
            expect(new Set(of).size).toBe(of.length);
            const ei = EVENTS.indexOf(e);
            if (!disposed) for (const i of kept[ei]!) if (held[ei]!.has(i) && !removedDuring(acts, got, i, e)) expect(of).toContain(i);
          }
          if (!disposed) {
            expect(b.deps!(ctx) !== deps).toBe(want.stale);
            expect(fillOf(b)).toBe(m.held ? PRESSED : m.hovered ? HOVER : FILL);
          }
          if (got.length > 0) seen.hit('reported');
        }
      } finally {
        errors.mockRestore();
      }
    }), runs(RUNS));
    seen.atLeast('reported', 20);
    seen.atLeast('throw', 5);
  }, timeoutFor(RUNS, 10));
});
