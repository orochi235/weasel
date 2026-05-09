import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import { buildGradientRamp, GradientRampCache } from './GradientRampCache';
import type { GradStop } from '@orochi235/weasel';

const BLACK_WHITE: GradStop[] = [
  { offset: 0, color: '#000000' },
  { offset: 1, color: '#ffffff' },
];

const RED_BLUE: GradStop[] = [
  { offset: 0, color: '#ff0000' },
  { offset: 1, color: '#0000ff' },
];

describe('buildGradientRamp', () => {
  it('returns a Uint8ClampedArray of length 256 × 4', () => {
    const ramp = buildGradientRamp(BLACK_WHITE);
    expect(ramp).toBeInstanceOf(Uint8ClampedArray);
    expect(ramp.length).toBe(256 * 4);
  });

  it('first pixel is the first stop color', () => {
    const ramp = buildGradientRamp(BLACK_WHITE);
    expect(Array.from(ramp.slice(0, 4))).toEqual([0, 0, 0, 255]);
  });

  it('last pixel is the last stop color', () => {
    const ramp = buildGradientRamp(BLACK_WHITE);
    expect(Array.from(ramp.slice(255 * 4, 256 * 4))).toEqual([255, 255, 255, 255]);
  });

  it('midpoint pixel is a linear blend', () => {
    const ramp = buildGradientRamp(BLACK_WHITE);
    const [r, g, b, a] = ramp.slice(128 * 4, 128 * 4 + 4);
    expect(r).toBeGreaterThanOrEqual(127);
    expect(r).toBeLessThanOrEqual(129);
    expect(g).toBe(r);
    expect(b).toBe(r);
    expect(a).toBe(255);
  });

  it('multi-stop: pixel before midstop is interpolated from stop 0 to stop 1', () => {
    const stops: GradStop[] = [
      { offset: 0,   color: '#ff0000' },
      { offset: 0.5, color: '#00ff00' },
      { offset: 1,   color: '#0000ff' },
    ];
    const ramp = buildGradientRamp(stops);
    const [r, g, b] = ramp.slice(64 * 4, 64 * 4 + 4);
    expect(r).toBeGreaterThan(100);
    expect(g).toBeGreaterThan(100);
    expect(b).toBeLessThan(20);
  });

  it('single-stop ramp fills entirely with that color', () => {
    const stops: GradStop[] = [{ offset: 0, color: '#ff0000' }];
    const ramp = buildGradientRamp(stops);
    for (let i = 0; i < 256; i++) {
      expect(ramp[i * 4]).toBe(255);
      expect(ramp[i * 4 + 1]).toBe(0);
      expect(ramp[i * 4 + 2]).toBe(0);
      expect(ramp[i * 4 + 3]).toBe(255);
    }
  });
});

describe('GradientRampCache', () => {
  it('upload() calls createTexture + texImage2D', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GradientRampCache(gl);
    const key = cache.upload(BLACK_WHITE);
    expect(typeof key).toBe('string');
    expect(calls.some((c) => c.name === 'createTexture')).toBe(true);
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(true);
  });

  it('upload() for identical stops returns the same key (cache hit)', () => {
    const { gl } = makeGLRecorder();
    const cache = new GradientRampCache(gl);
    const k1 = cache.upload(BLACK_WHITE);
    const k2 = cache.upload([...BLACK_WHITE]);
    expect(k1).toBe(k2);
  });

  it('upload() for different stops returns distinct keys', () => {
    const { gl } = makeGLRecorder();
    const cache = new GradientRampCache(gl);
    const k1 = cache.upload(BLACK_WHITE);
    const k2 = cache.upload(RED_BLUE);
    expect(k1).not.toBe(k2);
  });

  it('upload() does not createTexture twice for the same stops (idempotent)', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GradientRampCache(gl);
    cache.upload(BLACK_WHITE);
    const countBefore = calls.filter((c) => c.name === 'createTexture').length;
    cache.upload(BLACK_WHITE);
    const countAfter = calls.filter((c) => c.name === 'createTexture').length;
    expect(countBefore).toBe(countAfter);
  });

  it('bind() calls activeTexture + bindTexture', () => {
    const { gl, calls, reset } = makeGLRecorder();
    const cache = new GradientRampCache(gl);
    const key = cache.upload(BLACK_WHITE);
    reset();
    cache.bind(key, 1);
    expect(calls.some((c) => c.name === 'activeTexture')).toBe(true);
    expect(calls.some((c) => c.name === 'bindTexture')).toBe(true);
  });

  it('hitRate() returns a number in [0, 1]', () => {
    const { gl } = makeGLRecorder();
    const cache = new GradientRampCache(gl);
    cache.upload(BLACK_WHITE);
    cache.upload(BLACK_WHITE);
    cache.upload(BLACK_WHITE);
    const rate = cache.hitRate();
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(1);
  });
});
