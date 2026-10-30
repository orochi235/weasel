import { describe, it, expect, beforeEach } from 'vitest';
import { mat3, type GlMat3, PATH_M as M, PATH_L as L, PATH_Z as Z } from '@weasel-js/geom';
import type { RectPath, PolygonPath } from '@weasel-js/geom';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { FLOATS_PER_VERTEX, TEX_SLOT_OFFSET } from './drawBatch';
import { paintModeOf } from './shaders/batchFill';
import { stencilledEvenOdd } from './testing/stencilledEvenOdd';

describe('gradient units — which space a gradient measures its geometry in', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  const STOPS = [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }];
  const PATH: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };

  /**
   * The same square, even-odd with a touching contour — which tessellates to `requiresStencil` and so
   * takes the two-pass stencil fill through `gradFill` rather than the batch.
   * That is the only route left to that program for an ordinary fill, and it is
   * how these tests reach `u_worldInv` at all.
   */
  const EVEN_ODD: PolygonPath = stencilledEvenOdd({
    kind: 'polygon',
    commands: new Uint8Array([M, L, L, L, Z]),
    coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
  });

  /** Uniform locations are resolved at link time, when the gradient program is
   *  first built — captured before `reset()` clears the log the assertions read. */
  let worldInvLocs: unknown[];

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    r._gradFill();
    worldInvLocs = recorder.calls
      .filter((c) => c.name === 'getUniformLocation' && c.args[1] === 'u_worldInv')
      .map((c) => c.result);
    expect(worldInvLocs.length, 'gradient program should expose u_worldInv').toBeGreaterThan(0);
    recorder.reset();
  });

  /**
   * Every gradient rides the vertices now, so `units` shows up as what the
   * corners carry rather than as a matrix. These are the tests that catch the
   * fold composing its two matrices the wrong way round, or turning a conic the
   * wrong way.
   */
  describe('what the corners carry', () => {
    /** `a_uv` at each staged corner, and the paint mode they share. */
    function stagedUV(): { uv: [number, number][]; post: number[]; mode: number } {
      const call = recorder.calls.find(
        (c) => c.name === 'bufferSubData' && c.args[0] === recorder.gl.ARRAY_BUFFER,
      )!;
      const v = call.args[2] as Float32Array;
      const corners = [0, 1, 2, 3];
      return {
        uv: corners.map((i) => [v[i * FLOATS_PER_VERTEX + 6], v[i * FLOATS_PER_VERTEX + 7]]),
        post: corners.map((i) => v[i * FLOATS_PER_VERTEX + 8]),
        mode: paintModeOf(v[TEX_SLOT_OFFSET]),
      };
    }

    const LINEAR = {
      kind: 'linear-gradient' as const,
      from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, stops: STOPS,
    };

    const shifted = (paint: unknown, view?: Float32Array): void => {
      r.render([{
        kind: 'group',
        transform: mat3.translated(mat3.identity(), 100, 40),
        children: [{ kind: 'path', path: PATH, fill: { paint } }],
      }] as DrawCommand[], view);
    };

    it('a linear gradient defaults to screen space, so a shape starts partway along', () => {
      shifted(LINEAR);
      // Screen x 100..110 over a ramp spanning screen x 0..10, and no paint
      // mode of its own — the plain path already samples (position, row).
      expect(stagedUV().uv.map(([u]) => u)).toEqual([10, 11, 11, 10]);
      expect(stagedUV().mode).toBe(0);
      expect(stagedUV().post).toEqual([1, 1, 1, 1]);
    });

    it("units: 'local' measures the shape's own coordinates, so the ramp rides it", () => {
      shifted({ ...LINEAR, units: 'local' });
      expect(stagedUV().uv.map(([u]) => u)).toEqual([0, 1, 1, 0]);
    });

    // Scaled, because the fold composes two matrices and two translations
    // commute — under a translate-only group this passes either way round.
    it("units: 'world' measures the scene, so panning the view moves the ramp", () => {
      r.render([{
        kind: 'group',
        transform: mat3.scaled(mat3.translated(mat3.identity(), 100, 40), 2, 2),
        children: [{ kind: 'path', path: PATH, fill: { paint: { ...LINEAR, units: 'world' } } }],
      }] as DrawCommand[], mat3.translated(mat3.identity(), 25, 75));
      // World x 75..95: the shape's own 0..10 doubled and moved to 100..120,
      // less the view's 25.
      expect(stagedUV().uv.map(([u]) => u)).toEqual([7.5, 9.5, 9.5, 7.5]);
    });

    it('a radial gradient carries the point its own radius scales to 1', () => {
      shifted({
        kind: 'radial-gradient', center: { x: 100, y: 40 }, radius: 10, stops: STOPS,
        units: 'local',
      });
      // Local (0,0)..(10,10) against a center at (100,40) in that same space:
      // the corners sit 10 units of a 10-unit radius away in each axis.
      expect(stagedUV().uv).toEqual([[-10, -4], [-9, -4], [-9, -3], [-10, -3]]);
      expect(stagedUV().mode).toBe(3);
    });

    it('a conic gradient turns its coordinate by the angle rather than the shader', () => {
      shifted({
        kind: 'conic-gradient', center: { x: 0, y: 0 }, angle: Math.PI / 2, stops: STOPS,
        units: 'local',
      });
      // A quarter turn takes (x, y) to (y, -x), so the corner at local (10, 0)
      // reads as (0, -10).
      const [, topRight] = stagedUV().uv;
      expect(topRight[0]).toBeCloseTo(0, 5);
      expect(topRight[1]).toBeCloseTo(-10, 5);
      expect(stagedUV().mode).toBe(4);
    });

    it('a radial gradient puts its atlas row where a plain vertex keeps its alpha', () => {
      shifted({ kind: 'radial-gradient', center: { x: 5, y: 5 }, radius: 5, stops: STOPS });
      // One ramp in a 16-row atlas: the center of row 0, and the same on every
      // corner — the row does not vary across a shape.
      expect(new Set(stagedUV().post)).toEqual(new Set([0.5 / 16]));
    });
  });

  /**
   * `gradFill` still paints a touching even-odd gradient, which cannot join a run: its
   * mesh needs a stencil pass of its own. These pin the uniforms that route
   * takes.
   */
  describe('the stencil route, which still binds gradFill', () => {
    /** The matrix uploaded to `u_worldInv` on the last gradient draw. */
    function worldInv(): number[] {
      const upload = recorder.calls
        .filter((c) => c.name === 'uniformMatrix3fv' && worldInvLocs.includes(c.args[0]))
        .pop();
      expect(upload, 'expected a u_worldInv upload').toBeDefined();
      return Array.from(upload!.args[2] as Float32Array);
    }

    const evenOdd = (paint: unknown, view?: GlMat3): void => {
      r.render([{ kind: 'path', path: EVEN_ODD, fill: { paint } }] as DrawCommand[], view);
    };

    const RADIAL = {
      kind: 'radial-gradient' as const, center: { x: 0, y: 0 }, radius: 5, stops: STOPS,
    };

    it('defaults to screen space, leaving the mapping identity', () => {
      evenOdd(RADIAL);
      expect(worldInv()).toEqual(Array.from(mat3.identity()));
    });

    it("units: 'local' inverts the enclosing transform, so the paint rides the geometry", () => {
      r.render([{
        kind: 'group',
        transform: mat3.translated(mat3.identity(), 100, 40),
        children: [{ kind: 'path', path: EVEN_ODD, fill: { paint: { ...RADIAL, units: 'local' } } }],
      }] as DrawCommand[]);
      // A fragment at screen (100, 40) is the group's local origin.
      expect(mat3.apply(new Float32Array(worldInv()), 100, 40)).toEqual([0, 0]);
    });

    const worldInvUploads = (): number =>
      recorder.calls.filter((c) => c.name === 'uniformMatrix3fv' && worldInvLocs.includes(c.args[0])).length;

    it("units: 'local' under a group that flattens an axis binds no paint", () => {
      r.render([{
        kind: 'group',
        transform: mat3.scaled(mat3.identity(), 0, 1),
        children: [{ kind: 'path', path: EVEN_ODD, fill: { paint: { ...RADIAL, units: 'local' } } }],
      }] as DrawCommand[]);
      expect(worldInvUploads()).toBe(0);
    });

    it("units: 'world' under a view with no inverse binds no paint", () => {
      evenOdd({ ...RADIAL, units: 'world' }, mat3.scaled(mat3.identity(), 1e6, 1e-7));
      expect(worldInvUploads()).toBe(0);
    });

    it("units: 'world' inverts the frame's view matrix, pinning the paint to the scene", () => {
      evenOdd({ ...RADIAL, units: 'world' }, mat3.translated(mat3.identity(), 25, 75));
      // Screen (25, 75) is world origin.
      expect(mat3.apply(new Float32Array(worldInv()), 25, 75)).toEqual([0, 0]);
    });

    it("units: 'world' degrades to screen space when the caller passed no view", () => {
      evenOdd({ kind: 'conic-gradient', center: { x: 0, y: 0 }, angle: 0, stops: STOPS, units: 'world' });
      expect(worldInv()).toEqual(Array.from(mat3.identity()));
    });

    // Every other paint program applies the group's color matrix; the gradient
    // one did not, and a batched gradient made that a disagreement between two
    // routes to the same paint rather than a gap.
    it('applies the color matrix a group carries', () => {
      const cm = new Array(20).fill(0);
      cm[0] = 0.5; cm[6] = 0.5; cm[12] = 0.5; cm[18] = 1;
      r.render([{
        kind: 'group',
        colorMatrix: cm,
        children: [{ kind: 'path', path: EVEN_ODD, fill: { paint: RADIAL } }],
      }] as DrawCommand[]);
      const loc = r._gradFill().uniform('u_colorMatrix');
      expect(loc, 'gradient program should expose u_colorMatrix').toBeDefined();
      const upload = recorder.calls.find(
        (c) => c.name === 'uniformMatrix4fv' && c.args[0] === loc,
      );
      expect(upload, 'expected the matrix to reach the gradient program').toBeDefined();
      expect(Array.from(upload!.args[2] as Float32Array)[0]).toBe(0.5);
    });
  });

  describe('a paint whose space has no inverse', () => {
    const LOCAL_LINEAR = {
      kind: 'linear-gradient' as const,
      from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, stops: STOPS, units: 'local' as const,
    };

    const drawsUnder = (transform: GlMat3): number => {
      r.render([{
        kind: 'group', transform, children: [{ kind: 'path', path: PATH, fill: { paint: LOCAL_LINEAR } }],
      }] as DrawCommand[]);
      return recorder.calls.filter((c) => c.name === 'drawElements').length;
    };

    it('still draws under an invertible transform', () => {
      expect(drawsUnder(mat3.scaled(mat3.identity(), 2, 3))).toBeGreaterThan(0);
    });

    it('draws nothing under a zero scale, rather than drawing untransformed', () => {
      expect(drawsUnder(mat3.scaled(mat3.identity(), 0, 1))).toBe(0);
    });

    it('draws nothing under a transform too flat for its own scale', () => {
      expect(drawsUnder(mat3.scaled(mat3.identity(), 1e6, 1e-7))).toBe(0);
    });
  });
});
