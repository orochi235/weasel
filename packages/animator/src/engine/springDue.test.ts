import { describe, expect, it } from 'vitest';
import { ColorOverrideRegistry } from '../colorRegistry';
import { createTarget } from '../target';
import type { PhysicsHandle } from '../types';
import { createAnimatorCore } from './core';

/** An animator stepped by hand, counting how often it asks whether its host has unmounted:
 *  each animation's tick asks once, and a frame with animations waiting asks once more. That
 *  count is the stand-in for ticks here, since nothing public counts them. */
function setup() {
  let now = 0;
  let asked = 0;
  const core = createAnimatorCore({
    now: () => now,
    requestFrame() {},
    cancelFrame() {},
    tripwire: () => { asked += 1; return false; },
    colorOverrides: new ColorOverrideRegistry(),
  });
  return {
    animator: core.api,
    step: (ms: number) => { now += ms; core.tick(now); },
    /** How many times since the last call. */
    asked: () => { const n = asked; asked = 0; return n; },
    now: () => now,
  };
}

function box() {
  const b = { committed: 0 };
  return createTarget<number>({ get: () => b.committed, set: (v) => { b.committed = v; } });
}

type Script = (handle: PhysicsHandle<number>, frame: number) => void;

/** The frame a spring to `to` ends on, or a coast where `to` is null, and what it read on the
 *  way, with `script` run ahead of each frame. `told` gives it an `onTick`, which has it ticked
 *  every frame. */
function run(told: boolean, script: Script, to: number | null) {
  const { animator, step } = setup();
  const target = box();
  let done = -1;
  let frame = 0;
  const handle = animator.physics<number>({
    target, to, velocity: to === null ? 800 : 0,
    onDone: () => { done = frame; },
    ...(told ? { onTick: () => {} } : {}),
  });
  const read: number[] = [];
  step(0);
  for (frame = 1; frame < 2000 && done < 0; frame++) {
    script(handle, frame);
    step(16);
    read.push(target.read());
  }
  return { done, read };
}

describe('a spring or a coast on a target with no onTick', () => {
  it('is left unticked while it cannot yet be at rest', () => {
    const { animator, step, asked } = setup();
    const targets = Array.from({ length: 10 }, box);
    for (const target of targets) animator.spring({ target, to: 100 });
    step(0);
    asked();
    for (let i = 0; i < 10; i++) step(16);
    // Ten frames, each asking once for the ten springs waiting.
    expect(asked()).toBe(10);
    expect(targets[0].read()).toBeGreaterThan(0);
    expect(targets[0].read()).toBeLessThan(100);
  });

  it.each<[string, Script, (number | null)?]>([
    ['left alone', () => {}],
    ['a coast', () => {}, null],
    ['a coast pushed on the way', (h, frame) => { if (frame === 20) h.setVelocity(-300); }, null],
    ['a coast given a target', (h, frame) => { if (frame === 10) h.setTarget(40); }, null],
    ['retargeted on the way', (h, frame) => { if (frame === 12) h.setTarget(-250); }],
    ['retargeted to where it is nearly at rest', (h, frame) => { if (frame === 5) h.setTarget(0); }],
    ['pushed on the way', (h, frame) => { if (frame === 8) h.setVelocity(4000); }],
    ['stilled on the way', (h, frame) => { if (frame === 8) h.setVelocity(0); }],
    ['set coasting', (h, frame) => { if (frame === 6) h.setTarget(null); }],
    ['set coasting and given a target again', (h, frame) => {
      if (frame === 6) h.setTarget(null);
      if (frame === 9) h.setTarget(30);
    }],
    ['paused a while', (h, frame) => {
      if (frame === 4) h.pause();
      if (frame === 90) h.resume();
    }],
    ['slowed', (h, frame) => { if (frame === 3) h.setTimeScale(0.25); }],
  ])('ends on the frame one ticked every frame does, %s', (_name, script, to = 100) => {
    const quiet = run(false, script, to);
    const told = run(true, script, to);
    expect(quiet.done).toBeGreaterThan(0);
    expect(quiet.done).toBe(told.done);
    expect(quiet.read).toEqual(told.read);
  });

  it('is ticked a handful of times on its way to rest', () => {
    const { animator, step, asked } = setup();
    let done = false;
    animator.spring({ target: box(), to: 100, stiffness: 300, damping: 5, onDone: () => { done = true; } });
    // Waits throughout, so every frame asks once on its own account.
    animator.tween({ target: box(), to: 1, ms: 1e6 });
    step(0);
    asked();
    let frames = 0;
    while (!done && frames < 2000) { step(16); frames += 1; }
    expect(done).toBe(true);
    expect(frames).toBeGreaterThan(200);
    // What is left is the spring's own ticks.
    expect(asked() - frames).toBeLessThan(40);
  });

  it('leaves a coast unticked until it has slowed to rest', () => {
    const { animator, step, asked } = setup();
    const handle = animator.physics<number>({ target: box(), to: 100 });
    step(0);
    step(16);
    handle.setTarget(null);
    asked();
    for (let i = 0; i < 5; i++) step(16);
    expect(asked()).toBe(5);
    expect(animator.isActive()).toBe(true);
  });
});
