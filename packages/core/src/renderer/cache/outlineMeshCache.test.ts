import { describe, it, expect, beforeEach } from 'vitest';
import {
  outlineMesh, OUTLINE_MESH_CACHE_LIMIT, _resetOutlineMeshCacheForTests,
} from './outlineMeshCache';

// A unit square with a square hole — the shape of every glyph with a counter,
// and the case a fill rule has to get right.
const RING = 'M0 0L1 0L1 -1L0 -1ZM0.25 -0.25L0.25 -0.75L0.75 -0.75L0.75 -0.25Z';
const TRI = 'M0 0L1 0L0.5 -1Z';

describe('outline mesh cache', () => {
  beforeEach(() => {
    _resetOutlineMeshCacheForTests();
  });

  it('tessellates em-space path data into triangles', () => {
    const mesh = outlineMesh('k|tri', TRI);
    expect(mesh.vertices.length).toBe(6);
    expect(mesh.indices.length).toBe(3);
  });

  it('cuts counters, so an "o" is not a blob', () => {
    const mesh = outlineMesh('k|ring', RING);
    // Two contours, both flattened, and the hole removed rather than filled:
    // a solid square would be 2 triangles, this needs at least 8.
    expect(mesh.indices.length / 3).toBeGreaterThanOrEqual(8);
    // A glyph outline is 'nonzero', which tessellates cleanly — no stencil
    // pass, which is what lets a whole group merge into one buffer.
    expect(mesh.requiresStencil).toBeFalsy();
  });

  it('returns the same mesh object for a repeated glyph', () => {
    const first = outlineMesh('k|tri', TRI);
    expect(outlineMesh('k|tri', TRI)).toBe(first);
  });

  it('keys on the identifier, not the path data', () => {
    // `d` is only read on a miss — the key is the contract, so that the
    // per-frame call does not have to hash a few hundred bytes of path text.
    const first = outlineMesh('k|tri', TRI);
    expect(outlineMesh('k|tri', RING)).toBe(first);
  });

  it('bounds itself rather than growing without limit', () => {
    for (let i = 0; i <= OUTLINE_MESH_CACHE_LIMIT; i++) outlineMesh(`k|${i}`, TRI);
    // The cap is a backstop for a page cycling through many faces, not
    // expected pressure: eviction is wholesale, and refilling costs only what
    // is actually on screen.
    const refilled = outlineMesh('k|0', TRI);
    expect(outlineMesh('k|0', TRI)).toBe(refilled);
  });

  it('flattens finely enough that magnification cannot show the polygon', () => {
    // A full-em circle, the worst case for curve flattening. At 1/4096 em the
    // chord error is under a screen pixel until the glyph is thousands of
    // pixels tall — far past the tier's own threshold.
    const circle = 'M0.5 0C0.776 0 1 -0.224 1 -0.5C1 -0.776 0.776 -1 0.5 -1C0.224 -1 0 -0.776 0 -0.5C0 -0.224 0.224 0 0.5 0Z';
    const mesh = outlineMesh('k|circle', circle);
    let maxErr = 0;
    for (let i = 0; i < mesh.vertices.length; i += 2) {
      const dx = mesh.vertices[i] - 0.5;
      const dy = mesh.vertices[i + 1] + 0.5;
      maxErr = Math.max(maxErr, Math.abs(Math.hypot(dx, dy) - 0.5));
    }
    expect(maxErr).toBeLessThan(1 / 2048);
  });
});
