import { describe, expect, it } from 'vitest';
import { clampPitch, orbitAfterDrag, orbitAfterWheel, PITCH_LIMIT, wrapYaw } from './useOrbit';

const view = { yaw: 0, pitch: 0, distance: 5, target: { x: 0, y: 0, z: 0 } };

describe('clampPitch', () => {
  it('stops just short of the poles, where azimuth becomes undefined', () => {
    expect(clampPitch(Math.PI)).toBeCloseTo(PITCH_LIMIT);
    expect(clampPitch(-Math.PI)).toBeCloseTo(-PITCH_LIMIT);
    expect(PITCH_LIMIT).toBeLessThan(Math.PI / 2);
  });

  it('leaves an in-range pitch alone', () => {
    expect(clampPitch(0.3)).toBe(0.3);
  });
});

describe('wrapYaw', () => {
  it('wraps into (-PI, PI] so a value cannot drift without bound', () => {
    expect(wrapYaw(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapYaw(-3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapYaw(0.5)).toBeCloseTo(0.5);
  });

  it('keeps a full turn equivalent to no turn', () => {
    expect(wrapYaw(2 * Math.PI)).toBeCloseTo(0);
  });
});

describe('orbitAfterDrag', () => {
  it('turns horizontal movement into yaw and vertical into pitch', () => {
    const next = orbitAfterDrag(view, 100, 50);
    expect(next.yaw).not.toBe(view.yaw);
    expect(next.pitch).not.toBe(view.pitch);
  });

  it('is absolute against the drag start, so re-applying does not compound', () => {
    const once = orbitAfterDrag(view, 100, 50);
    const twice = orbitAfterDrag(view, 100, 50);
    expect(twice).toEqual(once);
  });

  it('clamps pitch rather than tumbling past the pole', () => {
    const next = orbitAfterDrag(view, 0, 100_000);
    expect(Math.abs(next.pitch)).toBeLessThanOrEqual(PITCH_LIMIT);
  });

  it('leaves distance and target untouched', () => {
    const next = orbitAfterDrag(view, 100, 50);
    expect(next.distance).toBe(view.distance);
    expect(next.target).toEqual(view.target);
  });
});

describe('orbitAfterWheel', () => {
  it('moves the camera in and out', () => {
    expect(orbitAfterWheel(view, 100, 0.5, 50).distance).toBeGreaterThan(view.distance);
    expect(orbitAfterWheel(view, -100, 0.5, 50).distance).toBeLessThan(view.distance);
  });

  it('is multiplicative, so a step feels the same at every distance', () => {
    const near = orbitAfterWheel({ ...view, distance: 2 }, 100, 0.5, 50);
    const far = orbitAfterWheel({ ...view, distance: 20 }, 100, 0.5, 50);
    expect(far.distance / 20).toBeCloseTo(near.distance / 2);
  });

  it('honours its bounds', () => {
    expect(orbitAfterWheel(view, 100_000, 0.5, 50).distance).toBe(50);
    expect(orbitAfterWheel(view, -100_000, 0.5, 50).distance).toBe(0.5);
  });
});
