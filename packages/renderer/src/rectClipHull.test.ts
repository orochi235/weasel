/**
 * A rect clip on a target where the batch shader decides hulls: snapped to
 * their grid, and carried as a hull for an item with a slanted edge across
 * it, so that item stays in the run instead of taking the stencil.
 * `hullClip.browser.test.ts` checks the pixels; this counts the draws.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { FLOATS_PER_VERTEX } from './drawBatch';
import { hullOf } from './shaders/batchFill';

const ARRAY_BUFFER = 0x8892;
const C = Math.SQRT1_2;
const EIGHTH_TURN = new Float32Array([C, C, 0, -C, C, 0, 0, 0, 1]);

describe('a rect clip where the shader decides hulls', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    // The recorder reports no sample count; a single-sampled canvas offers hulls.
    Object.defineProperty(r._batchVariants(), 'hulls', { value: true });
    recorder.reset();
  });

  const rect = (x: number, color = '#ff0000'): DrawCommand => ({
    kind: 'path', path: { kind: 'rect', x, y: 0, width: 10, height: 10 }, fill: { paint: { color } },
  } as DrawCommand);
  const clipped = (clip: object, children: DrawCommand[]): DrawCommand => ({
    kind: 'group', clip: { kind: 'rect', ...clip }, children,
  } as unknown as DrawCommand);
  const turned = (child: DrawCommand): DrawCommand =>
    ({ kind: 'group', transform: EIGHTH_TURN, children: [child] } as unknown as DrawCommand);

  const draws = () => recorder.calls.filter((c) => c.name === 'drawElements').map((c) => c.args[1] as number);
  const clipBitWrites = () => recorder.calls.filter((c) => c.name === 'stencilMask' && c.args[0] !== 0xFF);
  const uploads = () => recorder.calls
    .filter((c) => c.name === 'bufferSubData' && c.args[0] === ARRAY_BUFFER)
    .map((c) => ({ verts: c.args[2] as Float32Array, floats: c.args[4] as number }));
  /** Each staged vertex of the first upload as `[x, y, hull start, hull planes]`. */
  const vertices = (): number[][] => {
    const { verts, floats } = uploads()[0];
    const out: number[][] = [];
    for (let i = 0; i < floats; i += FLOATS_PER_VERTEX) {
      out.push([verts[i], verts[i + 1], ...hullOf(verts[i + FLOATS_PER_VERTEX - 1])]);
    }
    return out;
  };

  it('cuts to edges snapped to a sixteenth of a pixel', () => {
    r.render([clipped({ x: 0.03, y: 2.01, width: 5, height: 20 }, [rect(0)])]);
    expect(vertices().map(([x, y]) => [x, y])).toEqual([[0, 2], [5, 2], [5, 10], [0, 10]]);
  });

  it('keeps a slanted item across it in the run, tested against the rect as a hull', () => {
    r.render([
      rect(0, '#00ff00'),
      clipped({ x: 0, y: -100, width: 100, height: 200 }, [turned(rect(0)), rect(20)]),
      rect(40, '#00ff00'),
    ]);
    expect(draws()).toEqual([24]);
    expect(clipBitWrites()).toEqual([]);
    const v = vertices();
    // The turned rect goes in whole, naming four planes; its neighbors, cut on
    // the CPU or under no clip, name none.
    expect(v.map((p) => p[3])).toEqual([0, 0, 0, 0, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(v[4].slice(0, 2)).toEqual([0, 0]);
    expect(recorder.calls.some((c) => c.name === 'useProgram' && c.args[0] === r._batchVariants().get(false, true).handle))
      .toBe(true);
  });

  it('carries nested rect clips as one set of four planes', () => {
    r.render([
      clipped({ x: 0, y: -100, width: 100, height: 200 }, [
        clipped({ x: -50, y: -50, width: 60, height: 60 }, [
          clipped({ x: -40, y: -40, width: 60, height: 60 }, [turned(rect(0))]),
        ]),
      ]),
      rect(40),
    ]);
    expect(draws()).toEqual([12]);
    expect(clipBitWrites()).toEqual([]);
    expect(vertices()[0][3]).toBe(4);
  });

  it('goes back to the stencil past the plane budget', () => {
    // Planes facing three ways at once: the rect's, and two turned clips'.
    const t = Math.PI / 12;
    const twelfth = new Float32Array([Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t), 0, 0, 0, 1]);
    const turnedClip = (transform: Float32Array, child: DrawCommand): DrawCommand => ({
      kind: 'group', transform, clip: { kind: 'rect', x: -50, y: -50, width: 100, height: 100 }, children: [child],
    } as unknown as DrawCommand);
    r.render([
      clipped({ x: 0, y: -100, width: 100, height: 200 }, [
        turnedClip(EIGHTH_TURN, turnedClip(twelfth, rect(0))),
      ]),
    ]);
    expect(clipBitWrites().length).toBeGreaterThan(0);
    expect(draws().length).toBeGreaterThan(1);
  });
});
