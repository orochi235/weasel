import { describe, it, expect } from 'vitest';
import { planPixelRender, renderSceneToPixels } from './renderSceneToPixels';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';
import { rotateAroundAABBCenter } from './poseRotation';
import type { DrawCommand } from '../renderer/DrawCommand';
import type { Node, Scene } from 'core/scene/types';
import { createPoseOverrides } from 'core/scene/poseOverrides';

interface RectPose { x: number; y: number; width: number; height: number; rotation?: number }

function leaf(id: string, pose: RectPose, data: unknown): Node<unknown, 'default', RectPose> {
  return { id, kind: 'leaf', layer: 'default', parent: null, pose, data } as unknown as Node<unknown, 'default', RectPose>;
}

/** Flat single-layer stand-in: every node is a root, nothing nests. The render
 *  path walks layers and parentage and reads through pose overrides, so all
 *  three have to be present. */
function fakeScene(nodes: Node<unknown, 'default', RectPose>[]): Scene<unknown, 'default', RectPose> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return {
    layers: [{ id: 'default', visible: true, locked: false }],
    roots: nodes.map((n) => n.id),
    renderOrder: () => nodes.map((n) => n.id),
    renderOrderNodes: () => nodes,
    get: (id: string) => byId.get(id as unknown as (typeof nodes)[number]['id']),
    overrides: createPoseOverrides<RectPose>((id) => byId.get(id as unknown as (typeof nodes)[number]['id'])),
  } as unknown as Scene<unknown, 'default', RectPose>;
}

/** What the scene walk emitted for the fixture's one node. `planPixelRender`
 *  nests view group → layer group → per-node group. */
function soleNodeOutput(commands: readonly DrawCommand[]): DrawCommand {
  const layer = (commands[0] as unknown as { children: DrawCommand[] }).children[0];
  const nodeGroup = (layer as unknown as { children: DrawCommand[] }).children[0];
  return (nodeGroup as unknown as { children: DrawCommand[] }).children[0];
}

/** First command of `kind` anywhere in the tree. */
function findByKind(commands: readonly DrawCommand[], kind: string): DrawCommand | undefined {
  for (const c of commands) {
    if (c.kind === kind) return c;
    const kids = (c as unknown as { children?: DrawCommand[] }).children;
    if (kids) {
      const hit = findByKind(kids, kind);
      if (hit) return hit;
    }
  }
  return undefined;
}

const RECT = { x: 5, y: 10, width: 40, height: 20 };

describe('planPixelRender', () => {
  it('rounds output dims from rect × scale, per axis', () => {
    const p = planPixelRender({ scene: fakeScene([]), sourceRect: { x: 0, y: 0, width: 10.4, height: 5.5 }, scale: { x: 1, y: 1 } });
    expect(p.width).toBe(10);   // round(10.4)
    expect(p.height).toBe(6);   // round(5.5)
  });

  it('anisotropic scale lands in the view verbatim', () => {
    const p = planPixelRender({ scene: fakeScene([]), sourceRect: RECT, scale: { x: 3, y: 2 } });
    expect(p.view).toEqual({ x: 5, y: 10, scale: { x: 3, y: 2 } });
    expect(p.width).toBe(120);  // 40 × 3
    expect(p.height).toBe(40);  // 20 × 2
  });

  it('clamps output dims to a 1px minimum', () => {
    const p = planPixelRender({ scene: fakeScene([]), sourceRect: { x: 0, y: 0, width: 0.1, height: 0.1 }, scale: { x: 1, y: 1 } });
    expect(p.width).toBe(1);
    expect(p.height).toBe(1);
  });

  it('transparent by default: first command is the view group, no background fill', () => {
    const p = planPixelRender({ scene: fakeScene([]), sourceRect: RECT, scale: { x: 1, y: 1 } });
    expect(p.commands).toHaveLength(1);
    expect(p.commands[0].kind).toBe('group');
  });

  it('background parameter prepends a screen-space fill covering the output', () => {
    const p = planPixelRender({ scene: fakeScene([]), sourceRect: RECT, scale: { x: 2, y: 2 }, background: '#ffffff' });
    expect(p.commands[0]).toMatchObject({
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 80, height: 40 },
      fill: { fill: 'solid', color: '#ffffff' },
    });
    expect(p.commands[1].kind).toBe('group');
  });

  it('resolveImage feeds the default drawOne — bitmap passes straight through (single resample)', () => {
    const bmp = { width: 500, height: 300, close() {} } as unknown as ImageBitmap;
    const scene = fakeScene([leaf('i', { x: 0, y: 0, width: 10, height: 10 }, { image: { src: 'big' } })]);
    const p = planPixelRender({ scene, sourceRect: RECT, scale: { x: 4, y: 4 }, resolveImage: () => bmp });
    const img = findByKind([p.commands[p.commands.length - 1]], 'image') as { image?: ImageBitmap } | undefined;
    // The ORIGINAL bitmap rides the command — no intermediate raster.
    expect(img?.image).toBe(bmp);
  });

  it('source-rect cropping: view origin offsets node coordinates', () => {
    const scene = fakeScene([leaf('r', { x: 5, y: 10, width: 1, height: 1 }, { fill: { fill: { color: '#000' } } })]);
    const p = planPixelRender({ scene, sourceRect: RECT, scale: { x: 1, y: 1 } });
    // Node at the rect origin renders at output (0,0): the group transform is
    // viewToMat3({x:5, y:10, scale:{x:1,y:1}}) — translation = (-5, -10).
    const g = p.commands[0] as unknown as { transform: number[] };
    expect(g.transform[6]).toBe(-5);
    expect(g.transform[7]).toBe(-10);
  });

  it('rejects nonpositive or non-finite dimensions', () => {
    expect(() => planPixelRender({ scene: fakeScene([]), sourceRect: { x: 0, y: 0, width: 0, height: 10 }, scale: { x: 1, y: 1 } })).toThrow();
    expect(() => planPixelRender({ scene: fakeScene([]), sourceRect: RECT, scale: { x: -1, y: 1 } })).toThrow();
    expect(() => planPixelRender({ scene: fakeScene([]), sourceRect: RECT, scale: { x: NaN, y: 1 } })).toThrow();
  });

  it('rejects a non-finite sourceRect origin (negative/zero origins remain valid)', () => {
    expect(() => planPixelRender({ scene: fakeScene([]), sourceRect: { x: NaN, y: 0, width: 10, height: 10 }, scale: { x: 1, y: 1 } })).toThrow();
  });

  it('honors pose rotation — a rotated node plans differently from an upright one', () => {
    const box = { x: 10, y: 20, width: 40, height: 20 };
    const upright = planPixelRender({ scene: fakeScene([leaf('r', box, { fill: { color: '#000' } })]), sourceRect: RECT, scale: { x: 1, y: 1 } });
    const spun = planPixelRender({ scene: fakeScene([leaf('r', { ...box, rotation: Math.PI / 3 }, { fill: { color: '#000' } })]), sourceRect: RECT, scale: { x: 1, y: 1 } });
    const childOf = (p: typeof upright) => soleNodeOutput(p.commands);
    expect(childOf(spun)).not.toEqual(childOf(upright));
    const wrap = childOf(spun) as unknown as { kind: string; transform: Float32Array };
    expect(wrap.kind).toBe('group');
    expect(Array.from(wrap.transform)).toEqual(Array.from(rotateAroundAABBCenter(10, 20, 40, 20, Math.PI / 3)));
  });

  it('honors alphaFor — a dimmed node plans differently from an opaque one', () => {
    const scene = fakeScene([leaf('r', { x: 10, y: 20, width: 40, height: 20 }, { fill: { color: '#000' } })]);
    const opaque = planPixelRender({ scene, sourceRect: RECT, scale: { x: 1, y: 1 } });
    const dimmed = planPixelRender({ scene, sourceRect: RECT, scale: { x: 1, y: 1 }, alphaFor: () => 0.3 });
    const childOf = (p: typeof opaque) => soleNodeOutput(p.commands);
    expect(childOf(dimmed)).not.toEqual(childOf(opaque));
    expect(childOf(dimmed)).toMatchObject({ kind: 'group', alpha: 0.3 });
  });
});

describe('renderSceneToPixels — GL execution (glRecorder)', () => {
  const recorderFactory = (rec: ReturnType<typeof makeGLRecorder>) =>
    (w: number, h: number) => ({ width: w, height: h, getContext: () => rec.gl });

  it('sizes the viewport to the output grid and reads back the full rect', () => {
    const rec = makeGLRecorder();
    renderSceneToPixels({ scene: fakeScene([]), sourceRect: RECT, scale: { x: 3, y: 2 }, createCanvas: recorderFactory(rec) });
    const viewport = rec.calls.find((c) => c.name === 'viewport');
    expect(viewport?.args).toEqual([0, 0, 120, 40]);
    const read = rec.calls.find((c) => c.name === 'readPixels');
    expect(read?.args.slice(0, 4)).toEqual([0, 0, 120, 40]);
  });

  // Structural smoke only: compares recorded GL call NAMES, not byte output,
  // under jsdom. Real byte determinism is covered by tests/visual/render-to-pixels.spec.ts.
  it('same-context determinism: identical call sequences across runs', () => {
    const run = () => {
      const rec = makeGLRecorder();
      const scene = fakeScene([leaf('r', RECT, { fill: { color: '#123456' }, label: undefined })]);
      renderSceneToPixels({ scene, sourceRect: RECT, scale: { x: 2, y: 1 }, background: '#ffffff', createCanvas: recorderFactory(rec) });
      return rec.calls.map((c) => c.name).join(',');
    };
    expect(run()).toBe(run());
  });

  it('flips rows: GL bottom-up becomes top-down output', () => {
    const rec = makeGLRecorder();
    // Wrap the recorder gl so readPixels fills each GL row y with byte value y.
    const gl = new Proxy(rec.gl, {
      get(target, prop, receiver) {
        if (prop === 'readPixels') {
          return (_x: number, _y: number, w: number, h: number, _f: number, _t: number, out: Uint8Array) => {
            // Alpha pinned to 255 (opaque) so unpremultiply is a no-op here —
            // isolates row-flip behavior from the separate unpremultiply test below.
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                out[i] = out[i + 1] = out[i + 2] = y;
                out[i + 3] = 255;
              }
            }
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as typeof rec.gl;
    const img = renderSceneToPixels({
      scene: fakeScene([]),
      sourceRect: { x: 0, y: 0, width: 2, height: 3 },
      scale: { x: 1, y: 1 },
      createCanvas: (w, h) => ({ width: w, height: h, getContext: () => gl }),
    });
    // GL row 2 (top of image) must land in output row 0.
    expect(img.data[0]).toBe(2);
    expect(img.data[2 * 2 * 4]).toBe(0); // output bottom row = GL row 0
  });

  it('unpremultiplies on readback', () => {
    const rec = makeGLRecorder();
    const gl = new Proxy(rec.gl, {
      get(target, prop, receiver) {
        if (prop === 'readPixels') {
          return (_x: number, _y: number, w: number, h: number, _f: number, _t: number, out: Uint8Array) => {
            // Premultiplied half-transparent red everywhere: (128, 0, 0, 128).
            for (let i = 0; i < w * h * 4; i += 4) { out[i] = 128; out[i + 3] = 128; }
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as typeof rec.gl;
    const img = renderSceneToPixels({
      scene: fakeScene([]),
      sourceRect: { x: 0, y: 0, width: 1, height: 1 },
      scale: { x: 1, y: 1 },
      createCanvas: (w, h) => ({ width: w, height: h, getContext: () => gl }),
    });
    expect(Array.from(img.data)).toEqual([255, 0, 0, 128]);
  });

  it('performs ZERO devicePixelRatio reads (regression guard)', () => {
    let reads = 0;
    const original = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      get() { reads++; return 1; },
    });
    try {
      const rec = makeGLRecorder();
      renderSceneToPixels({ scene: fakeScene([]), sourceRect: RECT, scale: { x: 2, y: 2 }, createCanvas: recorderFactory(rec) });
      expect(reads).toBe(0);
    } finally {
      if (original) Object.defineProperty(window, 'devicePixelRatio', original);
      else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
    }
  });

  it('disposes the per-call renderer', () => {
    const rec = makeGLRecorder();
    renderSceneToPixels({ scene: fakeScene([]), sourceRect: RECT, scale: { x: 1, y: 1 }, createCanvas: recorderFactory(rec) });
    expect(rec.calls.map((c) => c.name)).toContain('deleteProgram');
  });

  it('throws when WebGL2 is unavailable (jsdom default canvas)', () => {
    // vitest.setup.ts stubs getContext('webgl2') to null.
    expect(() =>
      renderSceneToPixels({ scene: fakeScene([]), sourceRect: RECT, scale: { x: 1, y: 1 } }),
    ).toThrow(/WebGL2 is unavailable/);
  });

  it('throws when both gl and createCanvas are supplied', () => {
    const rec = makeGLRecorder();
    expect(() =>
      renderSceneToPixels({
        scene: fakeScene([]), sourceRect: RECT, scale: { x: 1, y: 1 },
        gl: rec.gl, createCanvas: recorderFactory(rec),
      }),
    ).toThrow(/mutually exclusive/);
  });
});
