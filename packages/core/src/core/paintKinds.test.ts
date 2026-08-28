/**
 * The paint-kind registry's actual contract: a consumer registers a sixth
 * kind and it draws, converts both frame directions, and serializes, with no
 * kit edits. Each assertion here is a kit dispatch site that would otherwise
 * fall off the end of a switch.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FillStyle, PolygonPath } from '@weasel-js/core';
import { serializeSvg } from '@weasel-js/svg';
import type { SvgNode } from '@weasel-js/svg';
import { registerPaintKind, asPaint, _resetPaintKindsForTests, listPaintKinds, getPaintKind } from './paintKinds';
import type { PaintKindEntry } from './paintKinds';
import { fillInPoseFrame, fillToBoundsFrame } from './fillInPoseFrame';
import { findNodeShape } from '../canvas/NodeShape';
import { registerProgram } from '../renderer/shaders/registerProgram';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';
import { WeaselRenderer } from '../renderer/WeaselRenderer';
import type { DrawCommand } from '../renderer/DrawCommand';

const M = 0, L = 1;

function triangle(): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([M, L, L]),
    coords: new Float32Array([0, 0, 100, 0, 50, 80]),
    fillRule: 'nonzero',
  };
}

/**
 * A sixth kind: a single-color wash whose geometry is one `origin` point in
 * the node's box. Deliberately not gradient-shaped — a kind that happened to
 * carry `stops` would pass through the gradient branches by accident and
 * prove nothing.
 */
interface WashFill {
  fill: 'test-wash';
  origin: { x: number; y: number };
  color: string;
  units?: 'bounds' | 'local';
}

const WASH_PROGRAM = 'test:wash';

/** Premultiplied, as every kit shader must be. */
const WASH_FRAG = `#version 300 es
precision mediump float;
in vec2 v_world;
uniform vec4 u_washColor;
out vec4 outColor;
void main() { outColor = vec4(u_washColor.rgb * u_washColor.a, u_washColor.a); }
`;

const WASH: FillStyle = asPaint<WashFill>({
  fill: 'test-wash',
  origin: { x: 0.25, y: 0.5 },
  color: '#ff00ff',
  units: 'bounds',
});

function washEntry(): PaintKindEntry {
  return {
    id: 'test-wash',
    label: 'Wash',
    seed: (color) => asPaint<WashFill>({ fill: 'test-wash', origin: { x: 0.5, y: 0.5 }, color, units: 'bounds' }),
    colorOf: (paint) => (paint as unknown as WashFill).color,
    bind: (ctx) => {
      const prog = ctx.program(WASH_PROGRAM);
      if (!prog) return null;
      ctx.gl.useProgram(prog.handle);
      ctx.setProjAndModel(prog);
      return prog;
    },
    inPoseFrame: (fill, box) => {
      const f = fill as unknown as WashFill;
      if (f.units !== 'bounds') return fill;
      return asPaint<WashFill>({
        ...f,
        origin: { x: box.x + f.origin.x * box.width, y: box.y + f.origin.y * box.height },
        units: 'local',
      });
    },
    toBoundsFrame: (fill, box) => {
      const f = fill as unknown as WashFill;
      if (box.width === 0 || box.height === 0) return fill;
      return asPaint<WashFill>({
        ...f,
        origin: { x: (f.origin.x - box.x) / box.width, y: (f.origin.y - box.y) / box.height },
        units: 'bounds',
      });
    },
    toSvg: (id, fill) => {
      const f = fill as unknown as WashFill;
      return `<linearGradient id="${id}"><stop offset="0" stop-color="${f.color}"/></linearGradient>`;
    },
  };
}

describe('paint-kind registry', () => {
  let dispose: (() => void) | null = null;

  beforeEach(() => {
    _resetPaintKindsForTests();
  });

  afterEach(() => {
    dispose?.();
    dispose = null;
    _resetPaintKindsForTests();
  });

  it('ships the five built-in kinds', () => {
    expect(listPaintKinds().map((k) => k.id)).toEqual([
      'solid', 'linear-gradient', 'radial-gradient', 'conic-gradient', 'pattern',
    ]);
  });

  it('adds a sixth kind to the list and removes it on dispose', () => {
    dispose = registerPaintKind(washEntry());
    expect(getPaintKind('test-wash')?.label).toBe('Wash');
    dispose();
    dispose = null;
    expect(getPaintKind('test-wash')).toBeUndefined();
  });

  it('restores the built-in when an override of one is disposed', () => {
    // Re-registering a built-in id is how a consumer closes a gap the kit
    // leaves — conic gradients still serialize as nothing. Disposing that
    // override must put the built-in back, not delete the kind outright.
    const off = registerPaintKind({
      ...getPaintKind('conic-gradient')!,
      toSvg: (id) => `<conic id="${id}"/>`,
    });
    expect(getPaintKind('conic-gradient')?.toSvg).toBeDefined();
    off();
    expect(getPaintKind('conic-gradient')?.label).toBe('Conic');
    expect(getPaintKind('conic-gradient')?.toSvg).toBeUndefined();
  });

  it('refuses a kind that converts one frame direction but not the other', () => {
    expect(() => registerPaintKind({ ...washEntry(), toBoundsFrame: undefined }))
      .toThrow(/missing toBoundsFrame/);
    expect(() => registerPaintKind({ ...washEntry(), inPoseFrame: undefined }))
      .toThrow(/missing inPoseFrame/);
  });

  it('converts a registered kind bounds → pose frame', () => {
    dispose = registerPaintKind(washEntry());
    const box = { x: 10, y: 20, width: 200, height: 40 };
    const out = fillInPoseFrame(WASH, box) as unknown as WashFill;
    expect(out.units).toBe('local');
    expect(out.origin).toEqual({ x: 10 + 0.25 * 200, y: 20 + 0.5 * 40 });
  });

  it('converts a registered kind pose → bounds frame', () => {
    dispose = registerPaintKind(washEntry());
    const box = { x: 10, y: 20, width: 200, height: 40 };
    // Start in the pose frame, so a no-op implementation cannot pass by
    // handing back the `bounds` value it was given.
    const posed = { ...(WASH as unknown as WashFill), origin: { x: 60, y: 40 }, units: 'local' as const };
    const back = fillToBoundsFrame(asPaint<WashFill>(posed), box) as unknown as WashFill;
    expect(back.units).toBe('bounds');
    expect(back.origin.x).toBeCloseTo(0.25);
    expect(back.origin.y).toBeCloseTo(0.5);
  });

  it('leaves an unregistered kind untouched rather than guessing a frame', () => {
    const alien = asPaint({ fill: 'not-registered', color: '#123456' });
    const box = { x: 10, y: 20, width: 200, height: 40 };
    expect(fillInPoseFrame(alien, box)).toBe(alien);
    expect(fillToBoundsFrame(alien, box)).toBe(alien);
  });

  it('serializes a registered kind into <defs> behind its url(#id)', () => {
    dispose = registerPaintKind(washEntry());
    const node: SvgNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'gradient', paint: WASH },
    } as unknown as SvgNode;
    const out = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 10, height: 10 } });
    const ref = /fill="url\(#([^)]+)\)"/.exec(out);
    expect(ref).not.toBeNull();
    expect(out).toContain(`<linearGradient id="${ref![1]}"><stop offset="0" stop-color="#ff00ff"/></linearGradient>`);
  });

  it('repaints a node whose kind registers after it was first painted', () => {
    // `NodeShape`'s paint slot memoizes per node and calls `fillInPoseFrame`
    // inside it, so the registry is ambient state that memo cannot see change.
    const node = {
      id: 'a', kind: 'leaf', layer: 'default',
      data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: WASH },
    } as never;
    const pose = { x: 10, y: 20, width: 200, height: 40 };
    const before = findNodeShape(node)!.paint!(node, pose as never) as Array<{ fill: unknown }>;
    expect((before[0].fill as unknown as WashFill).units).toBe('bounds');

    dispose = registerPaintKind(washEntry());

    const after = findNodeShape(node)!.paint!(node, pose as never) as Array<{ fill: unknown }>;
    expect((after[0].fill as unknown as WashFill).units).toBe('local');
  });

  it('paints a registered kind through its own program', () => {
    registerProgram(WASH_PROGRAM, '', WASH_FRAG);
    dispose = registerPaintKind(washEntry());
    const recorder = makeGLRecorder();
    const r = new WeaselRenderer({ gl: recorder.gl, width: 400, height: 300, dpr: 1 });
    recorder.reset();
    expect(() => r.render([{ kind: 'path', path: triangle(), fill: WASH } as DrawCommand])).not.toThrow();
    expect(recorder.calls.some((c) => c.name === 'drawElements')).toBe(true);
  });

  it('does not read a registered kind through the gradient branch', () => {
    // `draw.ts`'s dispatch used to fall through to an unguarded cast to the
    // gradient union, so a sixth kind read `fill.stops` off a paint with none.
    dispose = registerPaintKind({ ...washEntry(), bind: undefined });
    const recorder = makeGLRecorder();
    const r = new WeaselRenderer({ gl: recorder.gl, width: 400, height: 300, dpr: 1 });
    expect(() => r.render([{ kind: 'path', path: triangle(), fill: WASH } as DrawCommand])).not.toThrow();
  });
});
