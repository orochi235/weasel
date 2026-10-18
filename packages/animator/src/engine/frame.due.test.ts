import { describe, expect, it } from 'vitest';
import { AnimatorEventHub } from '../observe';
import type { AnimationSeed } from './context';
import { createFrame, type AnimatorClock } from './frame';
import { createTable } from './table';
import { createEmitter } from '@weasel-js/registry';

/** A table and a frame loop with nothing under them, and a log of every tick. */
function rig() {
  const clock: AnimatorClock = { frameT: null, elapsed: 0, timeScale: 1, paused: false };
  const hub = new AnimatorEventHub();
  const state = { now: 0, tripped: false };
  const log: string[] = [];
  const table = createTable({
    codec: { stop() {}, has: () => false, rate() {} },
    hub,
    elapsed: () => clock.elapsed,
    direction: () => (clock.timeScale < 0 ? -1 : 1),
    seedClock: () => { clock.frameT ??= state.now; },
    showNow() {},
    resting: () => false,
    framing: () => frame.framing(),
    requestFrame() {},
  });
  const frame = createFrame({
    clock, table, hub,
    codec: { frame() {} },
    targets: { settle() {}, show() {} },
    afterTicks: [],
    subscribers: createEmitter(),
    reread() {},
    requestFrame() {},
    tripwire: () => state.tripped,
  });
  let nextId = 1;
  /** Registers an animation that logs `name@clock` each tick and ends once its clock reaches `end`. */
  const start = (name: string, end: number, more: Partial<AnimationSeed> = {}) => table.register({
    id: nextId++,
    kind: 'tween',
    tick: (now) => {
      log.push(`${name}@${Math.round(now)}`);
      return now >= end;
    },
    ...more,
  });
  const tick = (t: number): string[] => {
    log.length = 0;
    state.now = t;
    frame.tick(t);
    return log.slice();
  };
  return { clock, table, state, start, tick };
}

describe('a frame and the animations it ticks', () => {
  it('ticks an animation with no `due` every frame', () => {
    const r = rig();
    r.start('a', 30);
    expect(r.tick(16)).toEqual(['a@16']);
    expect(r.tick(32)).toEqual(['a@32']);
    expect(r.table.animations.size).toBe(0);
  });

  it('leaves one with a `due` alone until its clock reaches it', () => {
    const r = rig();
    r.start('a', 100, { due: 100 });
    expect(r.tick(16)).toEqual([]);
    expect(r.tick(96)).toEqual([]);
    expect(r.tick(112)).toEqual(['a@112']);
    expect(r.table.animations.size).toBe(0);
  });

  it('ticks one that is due but not finished on every frame after', () => {
    const r = rig();
    r.start('a', 150, { due: 100 });
    expect(r.tick(120)).toEqual(['a@120']);
    expect(r.tick(136)).toEqual(['a@136']);
    expect(r.tick(152)).toEqual(['a@152']);
    expect(r.table.animations.size).toBe(0);
  });

  it('hands a due animation a clock no earlier than its `due`', () => {
    const r = rig();
    const seen: number[] = [];
    r.table.register({ id: 99, kind: 'tween', due: 0.3, tick: (now) => { seen.push(now); return now >= 0.3; } });
    r.clock.timeScale = 0.1;
    r.tick(1);
    r.tick(3);
    expect(seen.length).toBe(1);
    expect(seen[0]).toBeGreaterThanOrEqual(0.3);
  });

  it('wakes one later while it is paused, and sooner at a higher time scale', () => {
    const r = rig();
    const slow = r.start('slow', 100, { due: 100 });
    const fast = r.start('fast', 100, { due: 100 });
    r.tick(20);
    slow.pause();
    fast.setTimeScale(2);
    expect(r.tick(60)).toEqual(['fast@100']);
    expect(r.tick(200)).toEqual([]);
    slow.resume();
    expect(r.tick(270)).toEqual([]);
    expect(r.tick(280)).toEqual(['slow@100']);
  });

  it('ticks one with a `due` every frame while it plays backward, and leaves it to wait again forward', () => {
    const r = rig();
    const a = r.start('a', 1000, { due: 1000 });
    r.tick(0);
    expect(r.tick(100)).toEqual([]);
    a.setTimeScale(-1);
    expect(r.tick(120)).toEqual(['a@80']);
    expect(r.tick(140)).toEqual(['a@60']);
    a.setTimeScale(1);
    expect(r.tick(160)).toEqual([]);
    expect(r.table.waiting).toBe(1);
  });

  it('runs every clock backward while the animator plays backward, its own clock going on forward', () => {
    const r = rig();
    const a = r.start('a', 1000);
    r.tick(0);
    r.tick(100);
    r.table.turn(() => { r.clock.timeScale = -1; });
    expect(r.tick(130)).toEqual(['a@70']);
    expect(r.clock.elapsed).toBe(130);
    a.setTimeScale(-1);
    expect(r.tick(150)).toEqual(['a@90']);
  });

  it('counts the animator\'s own pause and time scale into every clock', () => {
    const r = rig();
    r.start('a', 100, { due: 100 });
    r.clock.timeScale = 0.5;
    expect(r.tick(100)).toEqual([]);
    r.clock.paused = true;
    expect(r.tick(1000)).toEqual([]);
    r.clock.paused = false;
    expect(r.tick(1100)).toEqual(['a@100']);
  });

  it('ticks those due in one frame, and those ticked every frame, in the order they registered', () => {
    const r = rig();
    r.start('a', 50, { due: 50 });
    r.start('b', 1000);
    r.start('c', 40, { due: 40 });
    r.start('d', 1000);
    expect(r.tick(16)).toEqual(['b@16', 'd@16']);
    expect(r.tick(64)).toEqual(['a@64', 'b@64', 'c@64', 'd@64']);
  });

  it('never ticks one whose `due` is Infinity, and says the frame loop may sleep when it is idle', () => {
    const r = rig();
    r.start('held', 0, { due: Infinity, idle: true });
    expect(r.tick(16)).toEqual([]);
    expect(r.clock.frameT).toBeNull();
    r.start('a', 1000);
    expect(r.tick(32)).toEqual(['a@16']);
    expect(r.clock.frameT).toBe(32);
  });

  it('leaves one unticked again when it is deferred, from waiting or from every frame', () => {
    const r = rig();
    const a = r.start('a', 1000);
    const b = r.start('b', 1000, { due: 50 });
    expect(r.tick(16)).toEqual(['a@16']);
    r.table.defer(a.id, 100);
    r.table.defer(b.id, 20);
    expect(r.table.waiting).toBe(2);
    expect(r.tick(32)).toEqual([]);
    expect(r.tick(48)).toEqual(['b@48']);
    expect(r.tick(112)).toEqual(['b@112']);
    expect(r.tick(120)).toEqual(['a@120', 'b@120']);
    expect(r.table.waiting).toBe(0);
    r.table.defer(999, 10);
  });

  it('never ticks one that was canceled while it waited', () => {
    const r = rig();
    const a = r.start('a', 100, { due: 100 });
    r.tick(16);
    a.cancel();
    expect(r.tick(200)).toEqual([]);
    expect(r.table.animations.size).toBe(0);
  });

  it('ticks every animation once the host has unmounted, so each can leave', () => {
    const r = rig();
    r.start('held', 0, { due: Infinity });
    r.start('a', 0, { due: 100 });
    r.tick(16);
    r.state.tripped = true;
    expect(r.tick(32)).toEqual(['held@32', 'a@32']);
    expect(r.table.animations.size).toBe(0);
  });

  it('reads an animation\'s clock without a frame having ticked it', () => {
    const r = rig();
    const a = r.start('a', 100, { due: 100 });
    r.tick(40);
    expect(r.table.clockOf(r.table.animations.get(a.id)!)).toBe(40);
  });

  it('charges animations that start between two frames the same wait', () => {
    const r = rig();
    r.start('a', 1000);
    r.state.now = 5;
    r.start('b', 1000);
    expect(r.tick(16)).toEqual(['a@16', 'b@16']);
  });
});
