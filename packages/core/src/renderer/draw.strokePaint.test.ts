/**
 * A stroke's paint, and an even-odd fill, are both full `FillStyle`s. SVG
 * import puts gradients in either deliberately, so the renderer has to paint
 * one rather than refuse it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { PolygonPath, Stroke, FillStyle } from '@weasel-js/core';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { _resetStrokeMeshCacheForTests } from './cache/strokeMeshCache';

const M = 0, L = 1, Z = 4;

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
  readonly program: unknown;
}

/** The GL state each `drawElements` of a frame sees, replayed from the
 *  recorded call sequence. */
function statesAtDraws(rec: Recorder): DrawState[] {
  let stencilEnabled = false;
  let stencilFunc: readonly unknown[] | null = null;
  let colorWrite = true;
  let program: unknown = null;
  const states: DrawState[] = [];
  for (const call of rec.calls) {
    if (call.name === 'enable' && call.args[0] === STENCIL_TEST) stencilEnabled = true;
    else if (call.name === 'disable' && call.args[0] === STENCIL_TEST) stencilEnabled = false;
    else if (call.name === 'stencilFunc') stencilFunc = call.args;
    else if (call.name === 'colorMask') colorWrite = call.args[0] === true;
    else if (call.name === 'useProgram') program = call.args[0];
    else if (call.name === 'drawElements') {
      states.push({ stencilEnabled, stencilFunc, colorWrite, program });
    }
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

/** A 1×256 RGBA upload — `GradientRampCache` bakes the stops into one, and it
 *  is the only texture in these frames. */
function uploadedRamps(rec: Recorder): readonly unknown[][] {
  return rec.calls
    .filter((c) => c.name === 'texImage2D' && c.args[3] === 256 && c.args[4] === 1)
    .map((c) => c.args as unknown[]);
}

function square(fillRule: 'nonzero' | 'evenodd'): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([M, L, L, L, Z]),
    coords: new Float32Array([0, 0, 100, 0, 100, 100, 0, 100]),
    fillRule,
  };
}

describe('renderer — non-solid even-odd fill', () => {
  let recorder: Recorder;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  });

  const renderFill = (fillRule: 'nonzero' | 'evenodd', fill: FillStyle): void => {
    recorder.reset();
    r.render([{ kind: 'path', path: square(fillRule), fill } as DrawCommand]);
  };

  it('bakes the gradient ramp for an even-odd fill', () => {
    renderFill('evenodd', GRADIENT);
    const ramps = uploadedRamps(recorder);
    expect(ramps).toHaveLength(1);
    // Red at offset 0, blue at offset 1 — not the black a substituted paint gives.
    const texels = ramps[0][8] as Uint8ClampedArray;
    expect(Array.from(texels.slice(0, 4))).toEqual([255, 0, 0, 255]);
    expect(Array.from(texels.slice(-4))).toEqual([0, 0, 255, 255]);
  });

  it('paints an even-odd gradient with the same program an ordinary one uses', () => {
    renderFill('nonzero', GRADIENT);
    const reference = statesAtDraws(recorder);
    expect(reference).toHaveLength(1);

    renderFill('evenodd', GRADIENT);
    const draws = statesAtDraws(recorder);
    // Parity into stencil bit 0, then the paint pass over the odd-covered pixels.
    expect(draws).toHaveLength(2);
    expect(draws[1].program).toBe(reference[0].program);
  });

  /** The parity pass writes bit 0 under a false colour mask and the paint pass
   *  reads it back. Binding the paint through `drawPathFillByKind` calls
   *  `applyClipTest`, which at clip depth 0 disables the stencil test outright —
   *  the fill then paints every covered pixel, holes included. */
  it('keeps the even-odd stencil test for a gradient fill', () => {
    renderFill('evenodd', GRADIENT);
    const [parity, paint] = statesAtDraws(recorder);
    expect(parity.colorWrite).toBe(false);
    expect(paint.colorWrite).toBe(true);
    expect(paint.stencilEnabled).toBe(true);
    expect(paint.stencilFunc).toEqual([EQUAL, 0x01, 0x01]);
  });
});
