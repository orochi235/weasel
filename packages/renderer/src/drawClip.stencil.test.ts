import { describe, it, expect } from 'vitest';
import { PATH_M as M, PATH_L as L, PATH_Z as Z } from '@weasel-js/geom';
import type { PolygonPath } from '@weasel-js/geom';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand, GroupDrawCommand } from './DrawCommand';
import { pushClip, popClip, drawGroup, dispatch } from './draw';
import { createRecorderCtx, SQUARE_CLIP } from './testing/recorderCtx';
import { stencilledEvenOdd } from './testing/stencilledEvenOdd';

describe('pushClip / popClip', () => {
  it('pushClip(level=1): sets bit 1 wherever the clip path covers, no ancestor test needed', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    pushClip(ctx, path, /* newDepth */ 1);
    // stencilMask should be 0x02 (bit 1) for the write
    expect(calls.find((c) => c.name === 'stencilMask' && c.args[0] === 0x02)).toBeDefined();
    // stencilFunc EQUAL ref=0x02 mask=0x00 (no ancestors at depth 1)
    const sf = calls.find((c) => c.name === 'stencilFunc');
    expect(sf!.args).toEqual([gl.EQUAL, 0x02, 0x00]);
    // stencilOp KEEP KEEP REPLACE
    const so = calls.find((c) => c.name === 'stencilOp');
    expect(so!.args).toEqual([gl.KEEP, gl.KEEP, gl.REPLACE]);
    // colorMask false then true (stencil-only pass)
    const cmCalls = calls.filter((c) => c.name === 'colorMask');
    expect(cmCalls[0].args).toEqual([false, false, false, false]);
    expect(cmCalls[cmCalls.length - 1].args).toEqual([true, true, true, true]);
  });

  it('pushClip(level=3): only writes bit 3 where bits 1+2 are already set', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    pushClip(ctx, path, /* newDepth */ 3);
    const sf = calls.find((c) => c.name === 'stencilFunc');
    // ref includes bits 1, 2, 3 (=0x0E); mask is ancestors only (bits 1+2 = 0x06)
    expect(sf!.args).toEqual([gl.EQUAL, 0x0E, 0x06]);
    // stencilMask for the new bit (filter out the 0x01 narrowing from
    // surrounding code if present)
    const clipSm = calls.find((c) => c.name === 'stencilMask' && c.args[0] !== 0x01);
    expect(clipSm!.args).toEqual([0x08]);  // bit 3
  });

  it('popClip(oldDepth=2): clears bit 3 along the path, preserves ancestor bits', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    popClip(ctx, path, /* oldDepth */ 2);
    // ref = ancestorMask(2) | (1 << 3) = 0x06 | 0x08 = 0x0E
    const sf = calls.find((c) => c.name === 'stencilFunc');
    expect(sf!.args).toEqual([gl.EQUAL, 0x0E, 0x0E]);
    // stencilMask = bit 3 only (filter out 0x01 narrowing if any)
    const clipSm = calls.find((c) => c.name === 'stencilMask' && c.args[0] !== 0x01);
    expect(clipSm!.args).toEqual([0x08]);
    // stencilOp ZERO for the write
    const so = calls.find((c) => c.name === 'stencilOp');
    expect(so!.args).toEqual([gl.KEEP, gl.KEEP, gl.ZERO]);
  });

  /**
   * Rasterizing into the stencil is what creates the obligation, so the flush
   * belongs to these two rather than to whoever calls them. `flushSolids`
   * touches no stencil state beyond enable/disable, so the first
   * stencilMask/Func/Op call is the clip op's own.
   */
  describe('drain the staged run first', () => {
    const stagedRect: DrawCommand = {
      kind: 'path',
      path: { kind: 'rect', x: 20, y: 0, width: 10, height: 10 },
      fill: { paint: { color: '#ff0000' } },
    } as DrawCommand;
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };

    const drainedBeforeStencil = (calls: ReturnType<typeof createRecorderCtx>['calls']): void => {
      const flushIdx = calls.findIndex((c) => c.name === 'drawElements');
      // `stencilMask`, not the func or op: a run drawn under a clip sets
      // those itself on the way to its draw.
      const stencilIdx = calls.findIndex((c) => c.name === 'stencilMask');
      expect(flushIdx).toBeGreaterThanOrEqual(0);
      expect(stencilIdx).toBeGreaterThan(flushIdx);
    };

    it('pushClip', () => {
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, stagedRect);
      pushClip(ctx, path, /* newDepth */ 1);
      drainedBeforeStencil(calls);
    });

    it('popClip, for a run staged under the bit it clears', () => {
      const { ctx, calls } = createRecorderCtx();
      ctx.clipDepth = 1;
      dispatch(ctx, stagedRect);
      popClip(ctx, path, /* oldDepth */ 0);
      drainedBeforeStencil(calls);
    });

    it('but not popClip for a run staged below that bit, which never tests it', () => {
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, stagedRect);
      popClip(ctx, path, /* oldDepth */ 0);
      expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);
      expect(ctx.drawBatch.length).toBe(6);
    });
  });
});

describe('drawGroup clip integration', () => {
  it('drawGroup with cmd.clip pushes clip and children draw under the test', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    const cmd: GroupDrawCommand = {
      kind: 'group',
      clip: SQUARE_CLIP,
      children: [{
        kind: 'path' as const,
        path: { kind: 'rect' as const, x: 0, y: 0, width: 5, height: 5 },
        fill: { paint: { color: '#fff' } },
      }],
    };
    drawGroup(ctx, cmd);
    // Find: stencilMask(0x02) before child draw, stencilFunc(EQUAL, 0x02, 0x02)
    // during child, popClip-style stencilOp ZERO after children.
    const idxPushMask = calls.findIndex(
      (c) => c.name === 'stencilMask' && c.args[0] === 0x02
    );
    const idxChildTest = calls.findIndex(
      (c, i) => i > idxPushMask
        && c.name === 'stencilFunc'
        && c.args[1] === 0x02
        && c.args[2] === 0x02
    );
    const idxPop = calls.findIndex(
      (c, i) => i > idxChildTest
        && c.name === 'stencilOp'
        && c.args[2] === gl.ZERO
    );
    expect(idxPushMask).toBeGreaterThanOrEqual(0);
    expect(idxChildTest).toBeGreaterThan(idxPushMask);
    expect(idxPop).toBeGreaterThan(idxChildTest);
  });

  it('drawGroup with cmd.clip stencils an image child (EQUAL against clip bit)', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    const cmd: GroupDrawCommand = {
      kind: 'group',
      clip: SQUARE_CLIP,
      children: [{ kind: 'image' as const, image: fakeBitmap, x: 0, y: 0, w: 16, h: 16 }],
    };
    drawGroup(ctx, cmd);

    // The image draw's applyClipTest at clipDepth=1: EQUAL against ancestor
    // mask 0x02 (bit 1), KEEP on all ops. Find that stencilFunc, then confirm
    // STENCIL_TEST is enabled at that point and a drawElements follows it
    // before the popClip clear pass (stencilOp ..., ZERO).
    const clipTestIdx = calls.findIndex(
      (c) => c.name === 'stencilFunc' && c.args[0] === gl.EQUAL && c.args[1] === 0x02 && c.args[2] === 0x02,
    );
    expect(clipTestIdx).toBeGreaterThanOrEqual(0);
    let enabled = false;
    for (let i = clipTestIdx; i >= 0; i--) {
      if (calls[i].name === 'disable' && calls[i].args[0] === gl.STENCIL_TEST) break;
      if (calls[i].name === 'enable' && calls[i].args[0] === gl.STENCIL_TEST) { enabled = true; break; }
    }
    expect(enabled).toBe(true);
    const popClipIdx = calls.findIndex(
      (c) => c.name === 'stencilOp' && c.args[2] === gl.ZERO,
    );
    const drawAfterClipTest = calls.findIndex(
      (c, i) => i > clipTestIdx && c.name === 'drawElements',
    );
    expect(drawAfterClipTest).toBeGreaterThan(clipTestIdx);
    expect(popClipIdx).toBeGreaterThan(drawAfterClipTest);
  });

  it('drawGroup without cmd.clip does not touch clip-level stencil bits', () => {
    const { ctx, calls } = createRecorderCtx();
    const cmd: GroupDrawCommand = {
      kind: 'group',
      children: [{
        kind: 'path' as const,
        path: { kind: 'rect' as const, x: 0, y: 0, width: 5, height: 5 },
        fill: { paint: { color: '#fff' } },
      }],
    };
    drawGroup(ctx, cmd);
    // No stencilMask writes to bits 1-7.
    const clipBitWrites = calls.filter(
      (c) => c.name === 'stencilMask'
        && c.args[0] !== 0x01
        && c.args[0] !== 0xff
        && c.args[0] !== 0
    );
    expect(clipBitWrites).toEqual([]);
  });

  it('drawGroup throws at depth 8', () => {
    // Build a chain of 8 nested clip groups.
    let cmd: GroupDrawCommand = {
      kind: 'group',
      children: [{
        kind: 'path',
        path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
        fill: { paint: { color: '#fff' } },
      }],
    };
    for (let i = 0; i < 8; i++) {
      cmd = {
        kind: 'group',
        clip: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
        children: [cmd],
      };
    }
    const { ctx } = createRecorderCtx();
    expect(() => drawGroup(ctx, cmd)).toThrow(/clip nesting depth exceeded \(max 7\)/);
  });
});

// Helper: a minimal polygon path for evenodd fill.
const POLYGON_EVENODD: PolygonPath = stencilledEvenOdd({
  kind: 'polygon',
  commands: new Uint8Array([M, L, L, L, Z]),
  coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
});

// Helper: a polygon path for stroke-stencil (inner/outer) — needs visible area.
const POLYGON_NONZERO: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([M, L, L, L, Z]),
  coords: new Float32Array([0, 0, 100, 0, 100, 100, 0, 100]),
  fillRule: 'nonzero',
};

describe('stencil-shaded passes honor ancestor clip', () => {
  it('drawPathFillStencil shaded pass uses EQUAL clipMask|0x01 when clipDepth=2', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    ctx.clipDepth = 2;
    // ancestorMask(2) = 0x06, so shaded ref = 0x07, mask = 0x07
    dispatch(ctx, { kind: 'path', path: POLYGON_EVENODD, fill: { paint: { color: '#f00' } } });

    // The shaded pass stencilFunc is the last EQUAL call (write pass uses ALWAYS).
    const equalCalls = calls.filter(
      (c) => c.name === 'stencilFunc' && c.args[0] === gl.EQUAL
    );
    expect(equalCalls.length).toBeGreaterThan(0);
    const shadedSF = equalCalls[equalCalls.length - 1];
    expect(shadedSF.args).toEqual([gl.EQUAL, 0x07, 0x07]);
  });

  it('drawPathFillStencil shaded pass collapses to EQUAL 0x01 0x01 when clipDepth=0', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    ctx.clipDepth = 0;
    dispatch(ctx, { kind: 'path', path: POLYGON_EVENODD, fill: { paint: { color: '#f00' } } });

    const equalCalls = calls.filter(
      (c) => c.name === 'stencilFunc' && c.args[0] === gl.EQUAL
    );
    expect(equalCalls.length).toBeGreaterThan(0);
    const shadedSF = equalCalls[equalCalls.length - 1];
    expect(shadedSF.args).toEqual([gl.EQUAL, 0x01, 0x01]);
  });

  it('drawPathStrokeStenciled inner shaded pass uses EQUAL clipMask|0x01 when clipDepth=1', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    ctx.clipDepth = 1;
    // ancestorMask(1) = 0x02, inner ref = 0x03, mask = 0x03
    dispatch(ctx, {
      kind: 'path',
      path: POLYGON_NONZERO,
      stroke: { paint: { color: '#000' }, width: 10, align: 'inner' },
    });

    const equalCalls = calls.filter(
      (c) => c.name === 'stencilFunc' && c.args[0] === gl.EQUAL
    );
    expect(equalCalls.length).toBeGreaterThan(0);
    const shadedSF = equalCalls[equalCalls.length - 1];
    expect(shadedSF.args).toEqual([gl.EQUAL, 0x03, 0x03]);
  });

  it('drawPathStrokeStenciled outer shaded pass: ref=clipMask, mask=clipMask|0x01 when clipDepth=1', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    ctx.clipDepth = 1;
    // ancestorMask(1) = 0x02, outer ref = 0x02 (bit 0 NOT set), mask = 0x03
    dispatch(ctx, {
      kind: 'path',
      path: POLYGON_NONZERO,
      stroke: { paint: { color: '#000' }, width: 10, align: 'outer' },
    });

    const equalCalls = calls.filter(
      (c) => c.name === 'stencilFunc' && c.args[0] === gl.EQUAL
    );
    expect(equalCalls.length).toBeGreaterThan(0);
    const shadedSF = equalCalls[equalCalls.length - 1];
    expect(shadedSF.args).toEqual([gl.EQUAL, 0x02, 0x03]);
  });
});

// ─── C1/I4 ────────────────────────────────────────────────────────────────────

describe('C1/I4: popClip enables STENCIL_TEST after evenodd child disables it', () => {
  it('popClip enables STENCIL_TEST even after a child disabled it', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    const cmd: GroupDrawCommand = {
      kind: 'group',
      clip: { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 },
      children: [{
        kind: 'path' as const,
        // evenodd polygon child — drawPathFillStencil ends with disable(STENCIL_TEST)
        path: POLYGON_EVENODD,
        fill: { paint: { color: '#f00' } },
      }],
    };
    drawGroup(ctx, cmd);

    // Find the popClip's stencilOp(KEEP, KEEP, ZERO) — the clear pass.
    // findLastIndex is ES2023+; use a manual reverse scan for TS compat.
    let popClipIdx = -1;
    for (let i = calls.length - 1; i >= 0; i--) {
      if (calls[i].name === 'stencilOp' && calls[i].args[2] === gl.ZERO) {
        popClipIdx = i;
        break;
      }
    }
    expect(popClipIdx).toBeGreaterThanOrEqual(0);

    // Walk backwards from the pop; confirm enable(STENCIL_TEST) appears before
    // any disable(STENCIL_TEST) in that backward scan.
    let foundEnable = false;
    for (let i = popClipIdx; i >= 0; i--) {
      if (calls[i].name === 'disable' && calls[i].args[0] === gl.STENCIL_TEST) break;
      if (calls[i].name === 'enable' && calls[i].args[0] === gl.STENCIL_TEST) {
        foundEnable = true;
        break;
      }
    }
    expect(foundEnable).toBe(true);
  });

  it('pushClip and popClip restore stencilMask(0xFF) on exit', () => {
    const { ctx, calls } = createRecorderCtx();
    const cmd: GroupDrawCommand = {
      kind: 'group',
      clip: SQUARE_CLIP,
      children: [],
    };
    drawGroup(ctx, cmd);

    // After the full group (push + pop), the last stencilMask call should be 0xFF.
    const stencilMaskCalls = calls.filter((c) => c.name === 'stencilMask');
    expect(stencilMaskCalls.length).toBeGreaterThan(0);
    const last = stencilMaskCalls[stencilMaskCalls.length - 1];
    expect(last.args[0]).toBe(0xFF);
  });
});

// ─── C2 ───────────────────────────────────────────────────────────────────────

describe('C2: frame-start stencilMask(0xFF) before clear', () => {
  it('render() sets stencilMask(0xFF) before clear(STENCIL_BUFFER_BIT)', () => {
    const recorder = makeGLRecorder();
    const r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
    r.render([]);
    const calls = recorder.calls;
    const clearIdx = calls.findIndex(
      (c) => c.name === 'clear' && (c.args[0] as number) & recorder.gl.STENCIL_BUFFER_BIT,
    );
    expect(clearIdx).toBeGreaterThanOrEqual(0);
    // stencilMask(0xFF) must appear before the clear.
    const maskBeforeClear = calls
      .slice(0, clearIdx)
      .some((c) => c.name === 'stencilMask' && c.args[0] === 0xFF);
    expect(maskBeforeClear).toBe(true);
  });
});
