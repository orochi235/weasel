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
});
