// apps/site/demos/__tests__/platformerAnimState.test.ts
import { describe, it, expect } from 'vitest';
import { CLIPS } from '../platformer/clips';
import { FADE_MS, createAnimState, nextAnimState, type AnimCtx } from '../platformer/animState';

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
    expect(s.fade).toBe(1);
    expect(s.switches).toBe(0);
  });

  it('switches to run when moving and back to idle when stopped', () => {
    let s = nextAnimState(createAnimState(), RUNNING, 1 / 60);
    expect(s.current).toBe('run');
    expect(s.switches).toBe(1);
    for (let i = 0; i < 60; i++) s = nextAnimState(s, GROUND, 1 / 60);
    expect(s.current).toBe('idle');
    expect(s.switches).toBe(2);
  });

  it('picks jump while rising and fall while descending', () => {
    let s = nextAnimState(createAnimState(), RISING, 1 / 60);
    expect(s.current).toBe('jump');
    s = nextAnimState(s, FALLING, 1 / 60);
    expect(s.current).toBe('fall');
  });

  it('lets hurt override everything', () => {
    const s = nextAnimState(createAnimState(), { ...RUNNING, hurt: true }, 1 / 60);
    expect(s.current).toBe('hurt');
  });

  it('completes the cross-fade over FADE_MS', () => {
    let s = nextAnimState(createAnimState(), RUNNING, 1 / 60);
    expect(s.fade).toBeCloseTo(1000 / 60 / FADE_MS, 9);
    const steps = Math.ceil(FADE_MS / 1000 / (1 / 60)) + 2;
    for (let i = 0; i < steps; i++) s = nextAnimState(s, RUNNING, 1 / 60);
    expect(s.fade).toBe(1);
  });

  it('starts the fade over at a switch made before the last one finished', () => {
    let s = nextAnimState(createAnimState(), RUNNING, 1 / 60);
    s = nextAnimState(s, RUNNING, 1 / 60);
    const mid = s.fade;
    s = nextAnimState(s, RISING, 1 / 60);
    expect(s.fade).toBeLessThan(mid);
    expect(s.switches).toBe(2);
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
});
