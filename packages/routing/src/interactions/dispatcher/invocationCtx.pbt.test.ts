/**
 * Property test of a drag's invocation context under translation: moving the world, the page, and the host's rect
 * by any whole amounts leaves its world delta and its screen delta as they were, and a delta is always its current
 * point less its start.
 */
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { runs } from '../../pbt.fixture';
import { createGestureFacts } from './gestureFacts';
import { buildInvocationCtx } from './invocationCtx';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const n = fc.integer({ min: -1e9, max: 1e9 });
const pt = fc.record({ x: n, y: n });

/** The context of each move of a drag pressed at `press` and moved through `moves`, read through a host at `rect`. */
function contexts(press: { x: number; y: number }, moves: { x: number; y: number }[], world: { x: number; y: number }, rect: { x: number; y: number }) {
  const facts = createGestureFacts();
  const toLocal = (cx: number, cy: number) => ({ x: cx - rect.x, y: cy - rect.y });
  facts.begin('g', { kind: 'pointerdown', x: press.x + world.x, y: press.y + world.y, clientX: press.x, clientY: press.y, ...MODS });
  return moves.map((p, i) => {
    const kind = i === moves.length - 1 ? 'pointerup' as const : 'pointermove' as const;
    const event = { kind, x: p.x + world.x, y: p.y + world.y, clientX: p.x, clientY: p.y, ...MODS };
    if (kind === 'pointermove') facts.sample('g', event as typeof event & { kind: 'pointermove' });
    return buildInvocationCtx(event, {}, null, facts.of('g'), toLocal).drag!;
  });
}

it('reads a drag\'s deltas alike wherever the world, the page, and the host sit', () => {
  fc.assert(fc.property(pt, fc.array(pt, { minLength: 1, maxLength: 8 }), pt, pt, pt, pt, (press, moves, world, rect, shift, worldShift) => {
    const here = contexts(press, moves, world, rect);
    const there = contexts(
      { x: press.x + shift.x, y: press.y + shift.y },
      moves.map((p) => ({ x: p.x + shift.x, y: p.y + shift.y })),
      { x: world.x - shift.x + worldShift.x, y: world.y - shift.y + worldShift.y },
      { x: rect.x + shift.x, y: rect.y + shift.y },
    );
    here.forEach((d, i) => {
      expect(d.delta).toEqual({ x: d.current.x - d.start.x, y: d.current.y - d.start.y });
      expect(d.screenDelta).toEqual({ x: moves[i]!.x - press.x, y: moves[i]!.y - press.y });
      expect(there[i]!.delta).toEqual(d.delta);
      expect(there[i]!.screenDelta).toEqual(d.screenDelta);
    });
    expect(here.at(-1)!.points).toHaveLength(moves.length);
  }), runs(500));
});
