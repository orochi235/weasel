/**
 * Tests of what the dispatcher remembers between a gesture's events: a stateful run against a model of several
 * gestures at once, under ids named like `Object.prototype` members, and the turn a multitouch gesture's fingers
 * make, which reads the same whichever way round its angles are measured from and skips an angle that is no number.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { DragSample } from '../actions/invoker';
import { runs, tally } from '../../pbt.fixture';
import { createGestureFacts, type GestureFactsStore } from './gestureFacts';
import type { InputEvent } from './matcher';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const IDS = ['pointer-1', 'pointer-2', 'multitouch', '__proto__', 'toString'];
const coord = fc.integer({ min: -1e6, max: 1e6 });
const angle = fc.integer({ min: -179, max: 180 });

const down = (x: number, y: number): InputEvent => ({ kind: 'pointerdown', x, y, clientX: x + 5, clientY: y - 5, ...MODS });
const touch = (a: number | undefined, spread?: number): InputEvent & { kind: 'multitouch' } =>
  ({ kind: 'multitouch', fingers: 2, ...(a !== undefined ? { angle: a } : {}), ...(spread !== undefined ? { spread } : {}), ...MODS });
const move = (x: number, y: number): InputEvent & { kind: 'pointermove' } => ({ kind: 'pointermove', x, y, ...MODS });

/** The turn from one angle to the next, the shorter way round; a half turn reads as -180. */
const wrap = (step: number): number => ((step % 360) + 540) % 360 - 180;

interface Gesture { origin?: { x: number; y: number }; points?: DragSample[]; startSpread?: number; turn?: { last: number; total: number } }
type Model = Map<string, Gesture>;

function check(model: Model, real: GestureFactsStore): void {
  for (const id of IDS) {
    const g = model.get(id) ?? {};
    const facts = real.of(id);
    expect(facts.origin && { x: facts.origin.x, y: facts.origin.y }).toEqual(g.origin);
    expect(facts.points).toEqual(g.points);
    expect(facts.startSpread).toBe(g.startSpread);
    expect(facts.rotation).toBe(g.turn?.total);
  }
}

type Cmd = fc.Command<Model, GestureFactsStore>;
const cmd = (label: string, run: (m: Model, r: GestureFactsStore) => void): Cmd => ({
  check: () => true,
  run: (m, r) => { run(m, r); check(m, r); },
  toString: () => label,
});
const id = fc.constantFrom(...IDS);
const commands = [
  fc.tuple(id, coord, coord).map(([g, x, y]) => cmd(`down ${g} ${x},${y}`, (m, r) => {
    r.begin(g, down(x, y));
    m.set(g, { ...m.get(g), origin: { x, y }, points: [{ x, y }] });
  })),
  fc.tuple(id, angle, fc.integer({ min: 1, max: 500 })).map(([g, a, s]) => cmd(`touch ${g} ${a}° ${s}`, (m, r) => {
    r.begin(g, touch(a, s));
    m.set(g, { ...m.get(g), startSpread: s, turn: { last: a, total: 0 } });
  })),
  fc.tuple(id, coord, coord).map(([g, x, y]) => cmd(`move ${g} ${x},${y}`, (m, r) => {
    r.sample(g, move(x, y));
    m.get(g)?.points?.push({ x, y });
  })),
  fc.tuple(id, angle).map(([g, a]) => cmd(`turn ${g} ${a}°`, (m, r) => {
    r.turn(g, touch(a));
    const t = m.get(g)?.turn;
    if (t) { t.total += wrap(a - t.last); t.last = a; }
  })),
  fc.tuple(id, fc.array(fc.record({ x: coord, y: coord }), { maxLength: 4 })).map(([g, trail]) => cmd(`resume ${g} ×${trail.length}`, (m, r) => {
    r.resumeTrail(g, trail);
    const was = m.get(g);
    if (was?.points) was.points = [...trail];
  })),
  id.map((g) => cmd(`drop ${g}`, (m, r) => { r.drop(g); m.delete(g); })),
  fc.constant(cmd('clear', (m, r) => { r.clear(); m.clear(); })),
];

describe('gesture facts', () => {
  it('remember each gesture apart, through long runs of begins, samples, turns, hand-offs, and drops', () => {
    fc.assert(fc.property(fc.commands(commands, { maxCommands: 120 }), (cmds) => {
      fc.modelRun(() => ({ model: new Map(), real: createGestureFacts() }), cmds);
    }), runs(300));
  });

  const turnOf = (angles: readonly (number | undefined)[]): number | undefined => {
    const facts = createGestureFacts();
    facts.begin('g', touch(angles[0]));
    for (const a of angles.slice(1)) facts.turn('g', touch(a));
    return facts.of('g').rotation;
  };
  const angles = fc.array(angle, { minLength: 1, maxLength: 40 });

  it('turns the same with every angle offset alike, or any one of them by whole turns', () => {
    fc.assert(fc.property(angles, fc.integer({ min: -1e6, max: 1e6 }), fc.array(fc.integer({ min: -50, max: 50 })), (as, c, turns) => {
      const total = turnOf(as)!;
      expect(Math.abs(total)).toBeLessThanOrEqual(180 * (as.length - 1));
      expect(turnOf(as.map((a) => a + c))).toBe(total);
      expect(turnOf(as.map((a, i) => a + 360 * (turns[i] ?? 0)))).toBe(total);
    }), runs(500));
  });

  it('skips an angle that is not a finite number, as if it never came', () => {
    const t = tally();
    const bad = fc.constantFrom(NaN, Infinity, -Infinity);
    fc.assert(fc.property(angles, fc.array(fc.tuple(fc.nat(40), bad), { minLength: 1, maxLength: 3 }), (as, spliced) => {
      const withBad: number[] = [...as];
      for (const [at, v] of spliced) withBad.splice(Math.min(at, withBad.length), 0, v);
      if (!Number.isFinite(withBad[0])) t.hit('opens on a bad angle');
      const total = turnOf(withBad);
      expect(Number.isFinite(total), String(total)).toBe(true);
      expect(total).toBe(turnOf(withBad.filter(Number.isFinite)) ?? 0);
    }), runs(500));
    t.expectHit('opens on a bad angle');
  });
});
