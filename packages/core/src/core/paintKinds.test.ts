/**
 * The paint-kind registry's actual contract: a consumer registers a sixth
 * kind and it draws, converts both frame directions, and serializes, with no
 * kit edits. Each assertion here is a kit dispatch site that would otherwise
 * fall off the end of a switch.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FillStyle, PolygonPath } from '@weasel-js/core';
import { serializeSvg } from '@weasel-js/svg';
import type { SvgNode } from '@weasel-js/svg';
import {
  registerPaintKind, asPaint, _resetPaintKindsForTests, listPaintKinds, getPaintKind, paintKindRegistry,
  registerPaintKindLoader, warmPaintKinds,
} from './paintKinds';
import type { PaintKindEntry } from './paintKinds';
import { fillInPoseFrame, fillToBoundsFrame } from './fillInPoseFrame';
import { findNodeShape } from '../canvas/NodeShape';
import { getProgramSource, registerProgram } from '../renderer/shaders/registerProgram';
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

  it('registers the shader programs a kind declares, and re-registering the same source is not a duplicate', () => {
    const programs = { 'test-declared': { vert: '', frag: WASH_FRAG } };
    dispose = registerPaintKind({ ...washEntry(), programs });
    expect(getProgramSource('test-declared')).toEqual(programs['test-declared']);
    // registerProgram throws on a duplicate id in production.
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect(() => registerPaintKind({ ...washEntry(), programs })()).not.toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('hands back the same list until the registry changes', () => {
    const before = listPaintKinds();
    expect(listPaintKinds()).toBe(before);
    dispose = registerPaintKind(washEntry());
    expect(listPaintKinds()).not.toBe(before);
    expect(listPaintKinds()).toBe(listPaintKinds());
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

  it('restores the built-in when two overrides are disposed out of order', () => {
    const conic = getPaintKind('conic-gradient')!;
    const a = registerPaintKind({ ...conic, label: 'A' });
    const b = registerPaintKind({ ...conic, label: 'B' });
    a();
    expect(getPaintKind('conic-gradient')?.label).toBe('B');
    b();
    expect(getPaintKind('conic-gradient')).toBe(conic);
  });

  it('reflects an override as a conflict over the kit entry, and notifies subscribers', () => {
    const listener = vi.fn();
    const off = paintKindRegistry.subscribe(listener);
    dispose = registerPaintKind({ ...getPaintKind('solid')!, label: 'Mine' });
    const solid = paintKindRegistry.entries().find((e) => e.key === 'solid')!;
    expect(solid.value.label).toBe('Mine');
    expect(solid.shadowed.map((s) => s.source)).toEqual(['kit']);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
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
    // The fallback color after the reference is `@weasel-js/svg`'s doing, for
    // renderers that cannot resolve a kind it invented; the id is what matters
    // here.
    const ref = /fill="url\(#([^)\s]+)\)[^"]*"/.exec(out);
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

describe('paint kinds loaded on demand', () => {
  beforeEach(() => {
    _resetPaintKindsForTests();
  });

  afterEach(() => {
    _resetPaintKindsForTests();
  });

  it('starts a lazy kind\'s load on first lookup, once, and registers what it resolves to', async () => {
    const load = vi.fn(async () => washEntry());
    registerPaintKindLoader('test-wash', load);
    const listener = vi.fn();
    const off = paintKindRegistry.subscribe(listener);

    expect(getPaintKind('test-wash')).toBeUndefined();
    expect(getPaintKind('test-wash')).toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);

    await warmPaintKinds(['test-wash']);
    expect(getPaintKind('test-wash')?.label).toBe('Wash');
    expect(listener).toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
    off();
  });

  it('draws nothing for a cold kind, starts its load, and draws it once it lands', async () => {
    registerProgram(WASH_PROGRAM, '', WASH_FRAG);
    const load = vi.fn(async () => washEntry());
    registerPaintKindLoader('test-wash', load);
    const recorder = makeGLRecorder();
    const r = new WeaselRenderer({ gl: recorder.gl, width: 400, height: 300, dpr: 1 });
    const frame = () => {
      recorder.reset();
      r.render([{ kind: 'path', path: triangle(), fill: WASH } as DrawCommand]);
      return recorder.calls.some((c) => c.name === 'drawElements');
    };

    expect(frame()).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
    await warmPaintKinds(['test-wash']);
    expect(frame()).toBe(true);
  });

  it('warms every lazily loadable built-in when given no list', async () => {
    expect(listPaintKinds().map((k) => k.id)).not.toContain('mesh-gradient');
    await warmPaintKinds();
    expect(getPaintKind('mesh-gradient')?.label).toBe('Mesh');
  });

  it('resolves at once for a kind that is already registered', async () => {
    await expect(warmPaintKinds(['solid'])).resolves.toBeUndefined();
  });

  it('rejects a kind that is neither registered nor loadable', async () => {
    await expect(warmPaintKinds(['no-such-kind'])).rejects.toThrow(/no-such-kind/);
  });

  it('does not retry a failed load on every lookup', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const load = vi.fn(async () => { throw new Error('offline'); });
    registerPaintKindLoader('test-wash', load);
    await expect(warmPaintKinds(['test-wash'])).rejects.toThrow(/offline/);
    expect(getPaintKind('test-wash')).toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('rejects a loader that resolves to a different kind', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    registerPaintKindLoader('test-other', async () => washEntry());
    await expect(warmPaintKinds(['test-other'])).rejects.toThrow(/resolved to "test-wash"/);
    expect(getPaintKind('test-wash')).toBeUndefined();
    error.mockRestore();
  });

  it('never calls a loader for a kind registered before its first lookup', () => {
    const load = vi.fn(async () => washEntry());
    registerPaintKindLoader('test-wash', load);
    const off = registerPaintKind(washEntry());
    expect(getPaintKind('test-wash')?.label).toBe('Wash');
    expect(load).not.toHaveBeenCalled();
    off();
  });
});

