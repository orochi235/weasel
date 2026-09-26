import type { View } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { clampZoomAbout, frameLocalToWorld, fromCameraView, toCameraView } from './cameraView';
import { worldToScreen } from './canvasCoords';
import type { WorldFrame } from './worldSpec';

const UP: WorldFrame = { originPx: { x: 200, y: 150 }, yDir: -1 };
const vt = { zoom: 2.5, pan: { x: 30, y: -40 } };

/** Where a weasel View puts a frame-local point. */
const project = (v: View, p: { x: number; y: number }) => ({
  x: (p.x - v.x) * v.scale.x,
  y: (p.y - v.y) * v.scale.y,
});

describe('camera as a weasel View', () => {
  it.each([
    ['default frame', undefined],
    ['moved origin, y up', UP],
  ] as const)('places every world point where labkit does (%s)', (_, frame) => {
    const v = toCameraView(vt, frame);
    for (const w of [
      { x: 0, y: 0 },
      { x: 13, y: -7 },
      { x: -120, y: 44 },
    ]) {
      const local = frameLocalToWorld(w, frame);
      const a = project(v, local);
      const b = worldToScreen(w, vt, frame);
      expect(a.x).toBeCloseTo(b.x);
      expect(a.y).toBeCloseTo(b.y);
    }
  });

  it('round-trips', () => {
    const back = fromCameraView(toCameraView(vt, UP), UP);
    expect(back.zoom).toBeCloseTo(vt.zoom);
    expect(back.pan.x).toBeCloseTo(vt.pan.x);
    expect(back.pan.y).toBeCloseTo(vt.pan.y);
  });
});

describe('clampZoomAbout', () => {
  const prev: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
  it('holds the anchor of a zoom that hits the bound', () => {
    // A 4x zoom about screen (100, 50): world under it stays (100, 50).
    const next: View = { x: 75, y: 37.5, scale: { x: 4, y: 4 } };
    const out = clampZoomAbout(prev, next, 0.5, 2);
    expect(out.scale.x).toBe(2);
    expect(100 / out.scale.x + out.x).toBeCloseTo(100);
    expect(50 / out.scale.y + out.y).toBeCloseTo(50);
  });

  it('passes a zoom inside the bounds and a pan through', () => {
    const inside: View = { x: 10, y: 5, scale: { x: 1.5, y: 1.5 } };
    expect(clampZoomAbout(prev, inside, 0.5, 2)).toBe(inside);
    const pan: View = { x: 10, y: 5, scale: { x: 1, y: 1 } };
    expect(clampZoomAbout(prev, pan, 0.5, 2)).toBe(pan);
  });
});
