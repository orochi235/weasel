import { describe, it, expect, afterEach, vi } from 'vitest';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { mat3 } from './math/mat3';
import { asPaint, registerPaintKind, type PaintBindContext } from 'core/paintKinds';
import type { DrawCommand } from './DrawCommand';

// A kind that binds nothing and only records what the renderer handed it.
const seen: PaintBindContext[] = [];
let unregister: (() => void) | null = null;

function register(): void {
  unregister = registerPaintKind({
    id: 'probe-kind',
    label: 'Probe',
    seed: () => asPaint({ fill: 'probe-kind' }),
    colorOf: () => undefined,
    bind: (ctx) => { seen.push(ctx); return null; },
  });
}

afterEach(() => {
  unregister?.();
  unregister = null;
  seen.length = 0;
});

const frame: DrawCommand[] = [{
  kind: 'path',
  path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
  fill: asPaint({ fill: 'probe-kind' }),
} as DrawCommand];

function fakeCanvas(gl: WebGL2RenderingContext) {
  const listeners = new Map<string, EventListener>();
  return {
    width: 0,
    height: 0,
    getContext: () => gl,
    addEventListener: (type: string, listener: EventListener) => { listeners.set(type, listener); },
    removeEventListener: () => {},
    fire: (type: string) => listeners.get(type)?.(new Event(type)),
  };
}

describe('paint-kind resources', () => {
  it('hands every frame of one renderer the same lifetime, and releases it on dispose', () => {
    register();
    const r = new WeaselRenderer({ gl: makeGLRecorder().gl, width: 10, height: 10, dpr: 1 });
    r.render(frame);
    r.render(frame);
    expect(seen).toHaveLength(2);
    expect(seen[0].resources).toBe(seen[1].resources);

    const release = vi.fn();
    seen[0].resources.onRelease(release);
    expect(release).not.toHaveBeenCalled();
    r.dispose();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('gives two renderers on one context separate lifetimes', () => {
    register();
    const gl = makeGLRecorder().gl;
    new WeaselRenderer({ gl, width: 10, height: 10, dpr: 1 }).render(frame);
    new WeaselRenderer({ gl, width: 10, height: 10, dpr: 1 }).render(frame);
    expect(seen[0].resources).not.toBe(seen[1].resources);
  });

  it('releases the lifetime on a context restore and opens a new one', () => {
    register();
    const canvas = fakeCanvas(makeGLRecorder().gl);
    const r = new WeaselRenderer({ canvas: canvas as unknown as HTMLCanvasElement, width: 10, height: 10, dpr: 1 });
    r.render(frame);
    const release = vi.fn();
    seen[0].resources.onRelease(release);
    canvas.fire('webglcontextlost');
    canvas.fire('webglcontextrestored');
    expect(release).toHaveBeenCalledTimes(1);
    r.render(frame);
    expect(seen[1].resources).not.toBe(seen[0].resources);
  });

  it('measures paint space in device pixels, pixel ratio included', () => {
    register();
    const r = new WeaselRenderer({ gl: makeGLRecorder().gl, width: 10, height: 10, dpr: 2 });
    r.render(frame, mat3.scaled(mat3.identity(), 3, 3));
    const world = seen[0].spaceToDevice('world')!;
    expect(mat3.apply(world, 1, 1)).toEqual([6, 6]);
    expect(seen[0].maxTextureSize).toBeGreaterThan(0);
  });
});
