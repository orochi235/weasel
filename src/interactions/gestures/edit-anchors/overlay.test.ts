/**
 * Tests for `createAnchorEditOverlayLayer` — the visual overlay layer
 * used while editing a path's anchors. Verifies (1) the layer is a no-op
 * when overlay state is null, (2) it emits a tangent line + control
 * circle per attached C/Q control, (3) it emits one anchor circle per
 * on-curve point, (4) selected anchors get the highlight fill,
 * (5) caller-supplied colors override the defaults.
 */
import { describe, it, expect } from 'vitest';
import { createAnchorEditOverlayLayer } from './overlay';
import {
  PATH_M,
  PATH_L,
  PATH_C,
  PATH_Q,
  PATH_Z,
  type PolygonPath,
} from 'features/paths/types';

const path = (commands: number[], coords: number[]): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array(commands),
  coords: new Float32Array(coords),
  fillRule: 'nonzero',
});

function runDraw(layer: ReturnType<typeof createAnchorEditOverlayLayer>) {
  // The layer ignores its inputs — it queries getOverlay only.
  return layer.draw(undefined, { x: 0, y: 0, scale: 1 } as never, { width: 0, height: 0 } as never);
}

describe('createAnchorEditOverlayLayer', () => {
  it('emits no draw commands when overlay state is null', () => {
    const layer = createAnchorEditOverlayLayer({ getOverlay: () => null });
    expect(runDraw(layer)).toEqual([]);
  });

  it('emits one anchor circle per on-curve point for a polyline', () => {
    // M(0,0) L(10,0) L(10,10) — three on-curve anchors, no controls.
    const pose = path([PATH_M, PATH_L, PATH_L], [0, 0, 10, 0, 10, 10]);
    const layer = createAnchorEditOverlayLayer({
      getOverlay: () => ({ pose, selectedAnchors: [] }),
    });
    const cmds = runDraw(layer) as { kind: string }[];
    // Three anchor circles, no tangents, no controls.
    expect(cmds).toHaveLength(3);
    expect(cmds.every((c) => c.kind === 'path')).toBe(true);
  });

  it('emits tangent line + control circle for each attached C control', () => {
    // M(0,0) C(c1 c2 a1): one anchor at (0,0), one at (5,0). Two controls.
    // Each control produces: 1 tangent line + 1 control circle.
    // Plus 2 anchor circles.
    const pose = path(
      [PATH_M, PATH_C],
      [0, 0, 1, 5, 4, 5, 5, 0],
    );
    const layer = createAnchorEditOverlayLayer({
      getOverlay: () => ({ pose, selectedAnchors: [] }),
    });
    const cmds = runDraw(layer);
    // 2 tangents + 2 control circles + 2 anchor circles = 6 commands.
    expect(cmds).toHaveLength(6);
  });

  it('emits 1 tangent + 1 control + 2 anchors for a quadratic', () => {
    // Q has a single control point used as both controlOut + controlIn.
    // enumerateAnchors records it once on each endpoint, so the overlay
    // renders it twice — once via anchor[0].controlOut, once via
    // anchor[1].controlIn. That gives 2 tangents + 2 control circles +
    // 2 anchors = 6 commands (same shape as C).
    const pose = path(
      [PATH_M, PATH_Q],
      [0, 0, 5, 10, 10, 0],
    );
    const layer = createAnchorEditOverlayLayer({
      getOverlay: () => ({ pose, selectedAnchors: [] }),
    });
    expect(runDraw(layer)).toHaveLength(6);
  });

  it('selected anchor index gets the highlight fill', () => {
    const pose = path([PATH_M, PATH_L], [0, 0, 10, 0]);
    const layer = createAnchorEditOverlayLayer({
      getOverlay: () => ({ pose, selectedAnchors: [1] }),
      anchorFill: '#ffffff',
      selectedAnchorFill: '#7fb069',
    });
    const cmds = runDraw(layer) as Array<{
      kind: string;
      fill?: { color: string };
    }>;
    // Two anchor circles. The second (index 1) gets the highlight fill.
    expect(cmds[0].fill?.color).toBe('#ffffff');
    expect(cmds[1].fill?.color).toBe('#7fb069');
  });

  it('honors custom anchor/control/tangent colors', () => {
    const pose = path(
      [PATH_M, PATH_C],
      [0, 0, 1, 5, 4, 5, 5, 0],
    );
    const layer = createAnchorEditOverlayLayer({
      getOverlay: () => ({ pose, selectedAnchors: [] }),
      tangentStroke: '#ff0000',
      controlFill: '#00ff00',
      anchorFill: '#0000ff',
    });
    const cmds = runDraw(layer) as Array<{
      stroke?: { paint?: { color: string } };
      fill?: { color: string };
    }>;
    // First two are tangents (paths with stroke set, no fill).
    expect(cmds[0].stroke?.paint?.color).toBe('#ff0000');
    expect(cmds[1].stroke?.paint?.color).toBe('#ff0000');
    // Next two are control circles.
    expect(cmds[2].fill?.color).toBe('#00ff00');
    expect(cmds[3].fill?.color).toBe('#00ff00');
    // Last two are anchors.
    expect(cmds[4].fill?.color).toBe('#0000ff');
    expect(cmds[5].fill?.color).toBe('#0000ff');
  });

  it('multi-contour path with Z resets controls between subpaths', () => {
    // Subpath 1: M(0,0) L(10,0) Z. Subpath 2: M(20,20) L(30,20).
    // 4 anchors total, 0 controls, 0 tangents → 4 commands.
    const pose = path(
      [PATH_M, PATH_L, PATH_Z, PATH_M, PATH_L],
      [0, 0, 10, 0, 20, 20, 30, 20],
    );
    const layer = createAnchorEditOverlayLayer({
      getOverlay: () => ({ pose, selectedAnchors: [] }),
    });
    expect(runDraw(layer)).toHaveLength(4);
  });
});
