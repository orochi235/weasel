import { describe, expect, test } from 'vitest';
import { FACTOR_STOPS } from './lensActionDefs';
import { ZOOM_INSET, zoomTrackOf } from './lensZoomTrack';

describe('zoomTrackOf', () => {
  test('a round body gets an arc across its bottom, short of 3 and 9 o’clock', () => {
    const track = zoomTrackOf('circle', { width: 160, height: 160 });
    expect(track.kind).toBe('arc');
    if (track.kind !== 'arc') return;
    const { start, end, direction, inset } = track.arc;
    expect(direction).toBe('ccw');
    expect(inset).toBe(ZOOM_INSET);
    expect(start).toBeGreaterThan(180);
    expect(start).toBeLessThan(270);
    expect(end).toBeGreaterThan(90);
    expect(end).toBeLessThan(180);
  });

  test('a round body stretched out of true gets an ellipse inside its rim', () => {
    const track = zoomTrackOf('circle', { width: 240, height: 160 });
    expect(track.kind).toBe('ellipse');
    if (track.kind !== 'ellipse') return;
    const shape = track.shape({ width: 240, height: 160 });
    expect(shape.kind).toBe('ellipse');
    const bottom = shape.at(0.5).point;
    expect(bottom.x).toBeCloseTo(120);
    expect(bottom.y).toBeCloseTo(160 - ZOOM_INSET);
  });

  test('a square body gets a straight run across its bottom, inset from it as the arc is and less from the sides', () => {
    const track = zoomTrackOf('square', { width: 240, height: 160 });
    expect(track.kind).toBe('line');
    if (track.kind !== 'line') return;
    const shape = track.shape({ width: 240, height: 160 });
    expect(shape.kind).toBe('line');
    expect(shape.at(0).point).toEqual({ x: 16, y: 160 - ZOOM_INSET });
    expect(shape.at(1).point).toEqual({ x: 240 - 16, y: 160 - ZOOM_INSET });
  });
});

test('the zoom stops are every power of two from 1× to 64×', () => {
  expect(FACTOR_STOPS).toEqual([1, 2, 4, 8, 16, 32, 64]);
});
