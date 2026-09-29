import { describe, it, expect } from 'vitest';
import { createRasterSession, renderSceneToPixels, type HeadlessCanvasLike } from './renderSceneToPixels';
import { makeGLRecorder, type GLRecorder } from '../renderer/test-utils/glRecorder';
import type { DrawCommand } from '../renderer/DrawCommand';
import type { Node, Scene } from 'core/scene/types';
import { createPoseOverrides } from 'core/scene/poseOverrides';

interface RectPose { x: number; y: number; width: number; height: number }

function leaf(id: string, pose: RectPose): Node<unknown, 'default', RectPose> {
  return { id, kind: 'leaf', layer: 'default', parent: null, pose, data: null } as unknown as Node<unknown, 'default', RectPose>;
}

function fakeScene(nodes: Node<unknown, 'default', RectPose>[]): Scene<unknown, 'default', RectPose> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return {
    layers: [{ id: 'default', visible: true, locked: false }],
    roots: nodes.map((n) => n.id),
    renderOrder: () => nodes.map((n) => n.id),
    renderOrderNodes: () => nodes,
    get: (id: string) => byId.get(id as never),
    overrides: createPoseOverrides<RectPose>((id) => byId.get(id as never)),
  } as unknown as Scene<unknown, 'default', RectPose>;
}

const M = 0, L = 1;
const BITMAP = { width: 8, height: 8 } as ImageBitmap;

/** Draws every node three ways, so a render touches each GL cache the
 *  session owns: an image (the bitmap texture cache), a radial-gradient
 *  stroke (unbatchable, so its ribbon takes the persistent mesh cache from
 *  its second sighting on), and a solid rect (the batch). */
const drawOne = (_node: unknown, p: RectPose): DrawCommand[] => [
  { kind: 'image', image: BITMAP, x: p.x, y: p.y, w: p.width, h: p.height },
  {
    kind: 'path',
    path: {
      kind: 'polygon',
      commands: new Uint8Array([M, L, L]),
      coords: new Float32Array([p.x, p.y, p.x + p.width, p.y, p.x + p.width, p.y + p.height]),
      fillRule: 'nonzero',
    },
    stroke: {
      paint: {
        fill: 'radial-gradient', center: { x: p.x, y: p.y }, radius: p.width,
        stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
      },
      width: 2,
    },
  },
  { kind: 'path', path: { kind: 'rect', x: p.x, y: p.y, width: 4, height: 4 }, fill: { fill: 'solid', color: '#00ff00' } },
] as DrawCommand[];

const SCENE_A = fakeScene([leaf('a', { x: 0, y: 0, width: 20, height: 10 })]);
const SCENE_B = fakeScene([leaf('b', { x: 5, y: 5, width: 10, height: 30 })]);

const names = (rec: GLRecorder, name: string) => rec.calls.filter((c) => c.name === name).length;

/** GL objects created and never deleted, grouped by type. */
function liveObjects(rec: GLRecorder): Record<string, number> {
  const live = new Map<unknown, string>();
  for (const c of rec.calls) {
    const created = /^create(Shader|Program|Buffer|VertexArray|Texture|Framebuffer|Renderbuffer)$/.exec(c.name);
    if (created) { live.set(c.result, created[1]); continue; }
    if (/^delete(Shader|Program|Buffer|VertexArray|Texture|Framebuffer|Renderbuffer)$/.test(c.name)) {
      live.delete(c.args[0]);
    }
  }
  const out: Record<string, number> = {};
  for (const kind of live.values()) out[kind] = (out[kind] ?? 0) + 1;
  return out;
}

describe('createRasterSession', () => {
  it('compiles the built-in programs once across many renders', () => {
    const rec = makeGLRecorder();
    const session = createRasterSession({ gl: rec.gl });
    session.render({ scene: SCENE_A, drawOne: drawOne as never, sourceRect: { x: 0, y: 0, width: 20, height: 10 }, scale: { x: 1, y: 1 } });
    const afterOne = names(rec, 'createProgram');
    expect(afterOne).toBeGreaterThan(0);
    for (let i = 0; i < 4; i++) {
      session.render({ scene: i % 2 ? SCENE_A : SCENE_B, drawOne: drawOne as never, sourceRect: { x: 0, y: 0, width: 20 + i, height: 40 }, scale: { x: 2, y: 1 } });
    }
    expect(names(rec, 'createProgram')).toBe(afterOne);
    expect(names(rec, 'linkProgram')).toBe(afterOne);
    session.dispose();
  });

  it('uploads a bitmap once across renders rather than once per render', () => {
    const rec = makeGLRecorder();
    const session = createRasterSession({ gl: rec.gl });
    const args = { scene: SCENE_A, drawOne: drawOne as never, sourceRect: { x: 0, y: 0, width: 20, height: 10 }, scale: { x: 1, y: 1 } };
    session.render(args);
    const texImages = names(rec, 'texImage2D');
    session.render(args);
    session.render(args);
    expect(names(rec, 'texImage2D')).toBe(texImages);
    session.dispose();
  });

  it('dispose frees every GL object the session created, caches included', () => {
    const rec = makeGLRecorder();
    const session = createRasterSession({ gl: rec.gl });
    const args = { scene: SCENE_A, drawOne: drawOne as never, sourceRect: { x: 0, y: 0, width: 20, height: 10 }, scale: { x: 1, y: 1 } };
    // Three sightings: the stroke ribbon goes persistent on the second.
    session.render(args);
    session.render(args);
    session.render({ ...args, scene: SCENE_B });
    session.render(args);
    expect(names(rec, 'createVertexArray')).toBeGreaterThan(0);
    expect(names(rec, 'createTexture')).toBeGreaterThan(0);
    session.dispose();
    expect(liveObjects(rec)).toEqual({});
  });

  it('a one-shot render on a caller-owned context leaves nothing behind', () => {
    const rec = makeGLRecorder();
    const args = { scene: SCENE_A, drawOne: drawOne as never, sourceRect: { x: 0, y: 0, width: 20, height: 10 }, scale: { x: 1, y: 1 }, gl: rec.gl };
    renderSceneToPixels(args);
    renderSceneToPixels(args);
    expect(liveObjects(rec)).toEqual({});
  });

  it('refuses to render after dispose, and dispose is idempotent', () => {
    const rec = makeGLRecorder();
    const session = createRasterSession({ gl: rec.gl });
    session.dispose();
    session.dispose();
    expect(() => session.render({ scene: SCENE_A, sourceRect: { x: 0, y: 0, width: 1, height: 1 }, scale: { x: 1, y: 1 } }))
      .toThrow(/disposed/);
  });

  it('creates its own canvas on first render and grows it, never shrinks it', () => {
    const rec = makeGLRecorder();
    const created: Array<[number, number]> = [];
    const canvas: HeadlessCanvasLike = { width: 0, height: 0, getContext: () => rec.gl };
    const session = createRasterSession({
      createCanvas: (w, h) => { created.push([w, h]); return canvas; },
    });
    expect(created).toEqual([]);
    session.render({ scene: SCENE_A, sourceRect: { x: 0, y: 0, width: 20, height: 10 }, scale: { x: 1, y: 1 } });
    expect(created).toEqual([[20, 10]]);
    expect([canvas.width, canvas.height]).toEqual([20, 10]);
    session.render({ scene: SCENE_A, sourceRect: { x: 0, y: 0, width: 8, height: 30 }, scale: { x: 1, y: 1 } });
    expect(created).toHaveLength(1);
    expect([canvas.width, canvas.height]).toEqual([20, 30]);
    // The render reads back its own size from the bottom-left of the buffer.
    const reads = rec.calls.filter((c) => c.name === 'readPixels');
    expect(reads.at(-1)!.args.slice(0, 4)).toEqual([0, 0, 8, 30]);
    const viewports = rec.calls.filter((c) => c.name === 'viewport');
    expect(viewports.at(-1)!.args).toEqual([0, 0, 8, 30]);
    session.dispose();
  });

  it('rejects gl together with createCanvas', () => {
    const rec = makeGLRecorder();
    expect(() => createRasterSession({ gl: rec.gl, createCanvas: () => ({ width: 0, height: 0, getContext: () => rec.gl }) }))
      .toThrow(/mutually exclusive/);
  });

  it('throws on a lost caller-owned context', () => {
    const rec = makeGLRecorder();
    const lost = new Proxy(rec.gl, {
      get: (t, p) => (p === 'isContextLost' ? () => true : (t as never)[p]),
    });
    const session = createRasterSession({ gl: lost });
    expect(() => session.render({ scene: SCENE_A, sourceRect: { x: 0, y: 0, width: 1, height: 1 }, scale: { x: 1, y: 1 } }))
      .toThrow(/lost/);
  });
});
