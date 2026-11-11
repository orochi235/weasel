/**
 * Stateful property test of exits that take their time: joins whose exit callback runs a transition that removes its
 * nodes, frames of any length, keys brought back mid-exit, and nodes removed from outside and then entered again,
 * against a model of which keys are bound, on their way out, or gone. A node on its way out is gone once its exit has
 * run and never before; a key brought back holds the pose its join gave it through every later frame; and a removal
 * pending for a node removed from outside never takes the node entered under its key after.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { asNodeId } from '@weasel-js/core';
import { d3Bind } from './bind';
import { makeAnimator, makeScene, runs, tally, timeoutFor, type Pose, type TestScene } from './pbt.fixture';

const RUNS = 120;
const FRAME = 16;
const KEYS = ['a', 'b', 'c', 'd', '__proto__', 'toString'] as const;

type Status = { bound: true; pose: Pose } | { bound: false; doneBy: number; dueAt: number };
interface Model { keys: Map<string, Status>; now: number }
interface Real { scene: TestScene; clock: ReturnType<typeof makeAnimator> }

const box = (x: number): Pose => ({ x, y: 0, width: 1, height: 1 });
const seen = tally();

function check(m: Model, r: Real): void {
  const held = new Set(r.scene.nodesOnLayer('graph').map((n) => String(n.id)));
  for (const k of KEYS) {
    const s = m.keys.get(k);
    if (s === undefined) { expect(held.has(k), `${k} gone`).toBe(false); continue; }
    if (s.bound) {
      expect(held.has(k), `${k} bound`).toBe(true);
      expect(r.scene.get(asNodeId(k))!.pose, `${k} at its joined pose`).toEqual(s.pose);
    } else if (m.now < s.dueAt) {
      expect(held.has(k), `${k} still on its way out`).toBe(true);
    } else if (m.now >= s.doneBy) {
      expect(held.has(k), `${k} exited`).toBe(false);
      m.keys.delete(k);
    }
  }
}

/** A key whose exit may or may not have run yet is settled by what the scene holds. */
function settle(m: Model, r: Real): void {
  for (const [k, s] of [...m.keys]) if (!s.bound && m.now >= s.dueAt && !r.scene.get(asNodeId(k))) m.keys.delete(k);
}

const cmd = (label: string, run: (m: Model, r: Real) => void, ...args: unknown[]): fc.Command<Model, Real> => ({
  check: () => true,
  run(m, r) { settle(m, r); run(m, r); seen.count(label); check(m, r); },
  toString: () => `${label}(${args.map((a) => JSON.stringify(a)).join(', ')})`,
});

const commands = [
  fc.tuple(fc.subarray([...KEYS]), fc.integer({ min: -50, max: 50 }), fc.option(fc.integer({ min: 0, max: 200 }), { freq: 4 })).map(([keys, x, exitMs]) =>
    cmd('join', (m, r) => {
      const b = d3Bind(r.scene, keys.map((id) => ({ id })), { key: (d) => d.id, animator: r.clock.animator }).pose(() => box(x));
      if (exitMs !== null) b.exit((sel) => { void sel.transition().duration(exitMs).pose(() => box(x - 100)).remove().end(); });
      b.join();
      for (const k of keys) {
        if (m.keys.get(k)?.bound === false) seen.count('brought back');
        m.keys.set(k, { bound: true, pose: box(x) });
      }
      for (const [k, s] of [...m.keys]) {
        if (keys.includes(k as never)) continue;
        if (exitMs === null) { m.keys.delete(k); continue; }
        // Its exit runs at least `exitMs` from now, and ends by the frame after one that reaches it.
        m.keys.set(k, { bound: false, dueAt: m.now + Math.max(exitMs, 1), doneBy: m.now + exitMs + 2 * FRAME });
        if (!s.bound) seen.count('exits afresh');
      }
    }, keys, x, exitMs)),
  fc.integer({ min: 1, max: 120 }).map((ms) => cmd('frame', (m, r) => {
    let left = ms;
    while (left > 0) {
      const step = Math.min(FRAME, left);
      r.clock.advance(step);
      m.now += step;
      left -= step;
    }
  }, ms)),
  fc.constantFrom(...KEYS).map((k) => cmd('remove', (m, r) => {
    if (!r.scene.get(asNodeId(k))) return;
    if (m.keys.get(k)?.bound === false) seen.count('removed mid-exit');
    r.scene.remove(asNodeId(k));
    m.keys.delete(k);
  }, k)),
  fc.tuple(fc.constantFrom(...KEYS), fc.integer({ min: -50, max: 50 })).map(([k, x]) => cmd('enter from outside', (m, r) => {
    if (r.scene.get(asNodeId(k))) return;
    r.scene.add({ id: asNodeId(k), kind: 'mark', layer: 'graph', pose: box(x), data: {} });
    m.keys.set(k, { bound: true, pose: box(x) });
  }, k, x)),
];

describe('d3Bind exits that take their time', () => {
  it('remove each exiting node once its exit has run, and only the node it began with', () => {
    fc.assert(fc.property(fc.commands(commands, { maxCommands: 50, size: 'large' }), (cmds) => {
      fc.modelRun(() => {
        const clock = makeAnimator();
        return { model: { keys: new Map(), now: 0 }, real: { scene: makeScene(), clock } };
      }, cmds);
    }), runs(RUNS));
    for (const what of ['join', 'frame', 'remove', 'enter from outside', 'brought back', 'exits afresh', 'removed mid-exit']) seen.atLeast(what, RUNS / 10);
  }, timeoutFor(RUNS, 100));
});
