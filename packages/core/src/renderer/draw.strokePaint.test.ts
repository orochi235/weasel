/**
 * A stroke's paint is a full `FillStyle`. SVG import puts gradients there
 * deliberately, so the renderer has to paint one rather than refuse it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { PolygonPath, Stroke, FillStyle } from '@weasel-js/core';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { _resetStrokeMeshCacheForTests } from './cache/strokeMeshCache';

const M = 0, L = 1;

function horizontalLine(): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([M, L, L]),
    coords: new Float32Array([0, 0, 100, 0, 200, 0]),
    fillRule: 'nonzero',
  };
}

const GRADIENT: FillStyle = {
  fill: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 200, y: 0 },
  stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
  units: 'local',
};

const STENCIL_TEST = 0x0B90;
const EQUAL = 0x0202;

interface DrawState {
  readonly stencilEnabled: boolean;
  readonly stencilFunc: readonly unknown[] | null;
  readonly colorWrite: boolean;
}

/** The GL state each `drawElements` of a frame sees, replayed from the
 *  recorded call sequence. */
function statesAtDraws(rec: Recorder): DrawState[] {
  let stencilEnabled = false;
  let stencilFunc: readonly unknown[] | null = null;
  let colorWrite = true;
  const states: DrawState[] = [];
  for (const call of rec.calls) {
    if (call.name === 'enable' && call.args[0] === STENCIL_TEST) stencilEnabled = true;
    else if (call.name === 'disable' && call.args[0] === STENCIL_TEST) stencilEnabled = false;
    else if (call.name === 'stencilFunc') stencilFunc = call.args;
    else if (call.name === 'colorMask') colorWrite = call.args[0] === true;
    else if (call.name === 'drawElements') states.push({ stencilEnabled, stencilFunc, colorWrite });
  }
  return states;
}

type Recorder = ReturnType<typeof makeGLRecorder>;

describe('renderer — non-solid stroke paint', () => {
  let recorder: Recorder;
  let r: WeaselRenderer;

  beforeEach(() => {
    _resetStrokeMeshCacheForTests();
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  });

  const render = (stroke: Stroke): void => {
    recorder.reset();
    r.render([{ kind: 'path', path: horizontalLine(), stroke } as DrawCommand]);
  };

  it('paints a gradient stroke instead of throwing', () => {
    expect(() => render({ width: 10, paint: GRADIENT })).not.toThrow();
  });

  it('paints a gradient stroke on an inner-aligned polygon instead of throwing', () => {
    expect(() => render({ width: 10, align: 'inner', paint: GRADIENT })).not.toThrow();
  });

  /** Inner/outer alignment paints a doubled ribbon and stencils half of it
   *  away, so the ribbon draw carries GL state this function set up itself.
   *  Binding the paint through `drawPathFillByKind` calls `applyClipTest`,
   *  which at clip depth 0 disables the stencil test outright — the stroke
   *  then paints at double width, centred, and nothing throws. */
  it('keeps the alignment stencil test for a gradient ribbon', () => {
    for (const [align, keepRef] of [['inner', 0x01], ['outer', 0x00]] as const) {
      render({ width: 10, align, paint: GRADIENT });
      const draws = statesAtDraws(recorder);
      // The silhouette into stencil bit 0, then the ribbon clipped against it.
      expect(draws).toHaveLength(2);
      const [silhouette, ribbon] = draws;
      expect(silhouette.colorWrite).toBe(false);
      expect(ribbon.colorWrite).toBe(true);
      expect(ribbon.stencilEnabled).toBe(true);
      expect(ribbon.stencilFunc).toEqual([EQUAL, keepRef, 0x01]);
    }
  });
});
