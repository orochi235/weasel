// apps/site/demos/__tests__/platformerAnimState.test.ts
import { describe, it, expect } from 'vitest';
import { CLIPS } from '../platformer/clips';
import { FADE_MS, createAnimState, nextAnimState, resolvePose, type AnimCtx } from '../platformer/animState';

const GROUND: AnimCtx = { onGround: true, vx: 0, vy: 0, hurt: false };
const RUNNING: AnimCtx = { onGround: true, vx: 150, vy: 0, hurt: false };
const RISING: AnimCtx = { onGround: false, vx: 0, vy: -300, hurt: false };
const FALLING: AnimCtx = { onGround: false, vx: 0, vy: 300, hurt: false };

describe('nextAnimState', () => {
  it('starts idle and stays idle while still on the ground', () => {
    let s = createAnimState();
    expect(s.current).toBe('idle');
    for (let i = 0; i < 30; i++) s = nextAnimState(s, GROUND, 1 / 60);
    expect(s.current).toBe('idle');
    expect(s.outgoing).toBe(null);
  });

  it('switches to run when moving and back to idle when stopped', () => {
    let s = nextAnimState(createAnimState(), RUNNING, 1 / 60);
    expect(s.current).toBe('run');
    expect(s.outgoing).not.toBe(null);
    for (let i = 0; i < 60; i++) s = nextAnimState(s, GROUND, 1 / 60);
    expect(s.current).toBe('idle');
  });

  it('picks jump while rising and fall while descending', () => {
    let s = nextAnimState(createAnimState(), RISING, 1 / 60);
    expect(s.current).toBe('jump');
    s = nextAnimState(s, FALLING, 1 / 60);
    expect(s.current).toBe('fall');
  });

  it('lets hurt override everything', () => {
    let s = nextAnimState(createAnimState(), { ...RUNNING, hurt: true }, 1 / 60);
    expect(s.current).toBe('hurt');
  });

  it('completes the cross-fade over FADE_MS and then drops the outgoing snapshot', () => {
    let s = nextAnimState(createAnimState(), RUNNING, 1 / 60);
    expect(s.fade).toBeLessThan(1);
    expect(s.outgoing).not.toBe(null);
    const steps = Math.ceil(FADE_MS / 1000 / (1 / 60)) + 2;
    for (let i = 0; i < steps; i++) s = nextAnimState(s, RUNNING, 1 / 60);
    expect(s.fade).toBe(1);
    expect(s.outgoing).toBe(null);
  });

  it('scales the run cycle phase with ground speed', () => {
    let slow = nextAnimState(createAnimState(), { ...RUNNING, vx: 40 }, 1 / 60);
    let fast = nextAnimState(createAnimState(), { ...RUNNING, vx: 170 }, 1 / 60);
    for (let i = 0; i < 10; i++) {
      slow = nextAnimState(slow, { ...RUNNING, vx: 40 }, 1 / 60);
      fast = nextAnimState(fast, { ...RUNNING, vx: 170 }, 1 / 60);
    }
    expect(fast.phase).toBeGreaterThan(slow.phase);
  });

  it('drives jump and fall by velocity instead of elapsed time', () => {
    const slowRise = nextAnimState(createAnimState(), { ...RISING, vy: -50 }, 1 / 60);
    const fastRise = nextAnimState(createAnimState(), { ...RISING, vy: -450 }, 1 / 60);
    // Faster rise sits nearer the launch key; slower rise nears the apex.
    expect(fastRise.phase).toBeLessThan(slowRise.phase);
  });

  it('wraps the run phase instead of growing without bound', () => {
    let s = createAnimState();
    for (let i = 0; i < 2000; i++) s = nextAnimState(s, RUNNING, 1 / 60);
    expect(s.phase).toBeGreaterThanOrEqual(0);
    expect(s.phase).toBeLessThanOrEqual(CLIPS.run.duration);
  });

  it('does not pop when a clip switches again before the previous fade finishes', () => {
    // idle -> run, one tick in: fade is well under 1, so run's cross-fade is
    // still visibly blending with idle when the very next switch happens.
    let s = nextAnimState(createAnimState(), RUNNING, 1 / 60);
    const before = resolvePose(s);
    s = nextAnimState(s, RISING, 1 / 60);
    const after = resolvePose(s);
    // torso and foreL distinguish idle/run/jump sharply enough to catch a pop,
    // but a real one-tick blend step moves them only a hair.
    expect(Math.abs(after.torso!.rotation! - before.torso!.rotation!)).toBeLessThan(0.02);
    expect(Math.abs(after.foreL!.rotation! - before.foreL!.rotation!)).toBeLessThan(0.02);
  });
});

describe('resolvePose', () => {
  it('returns a pose with no outgoing snapshot', () => {
    const pose = resolvePose(createAnimState());
    expect(Object.keys(pose).length).toBeGreaterThan(0);
  });

  it('blends toward the new clip as the fade advances', () => {
    let s = nextAnimState(createAnimState(), RUNNING, 1 / 60);
    const early = resolvePose(s);
    for (let i = 0; i < 4; i++) s = nextAnimState(s, RUNNING, 1 / 60);
    const later = resolvePose(s);
    expect(early).not.toEqual(later);
    expect(Object.keys(later).length).toBeGreaterThan(0);
  });
});
