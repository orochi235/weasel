import { describe, it, expect, beforeEach } from 'vitest';
import { findNodeShape, findShapeSilhouette } from './NodeShape';
import {
  __setImageLoaderForTests,
  _resetImageCacheForTests,
  getImageBitmap,
} from 'features/images/imageCache';
import type { Node } from 'core/scene/types';
import type { ImageNodeData } from 'features/images/imageCache';
import { makeGLRecorder } from 'renderer/test-utils/glRecorder';
import { WeaselRenderer } from 'renderer/WeaselRenderer';
import { FLOATS_PER_VERTEX } from 'renderer/drawBatch';

const fakeBitmap = (): ImageBitmap =>
  ({ width: 2, height: 2, close() {} } as unknown as ImageBitmap);

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const POSE = { x: 10, y: 20, width: 30, height: 40 };

function imageNode(
  src: string,
  extra: Omit<ImageNodeData['image'], 'src'> = {},
): Node<unknown, string, unknown> {
  return {
    id: 'i1', kind: 'leaf', layer: 'default', parent: null,
    pose: POSE, data: { image: { src, ...extra } },
  } as unknown as Node<unknown, string, unknown>;
}

describe('kit:image painter', () => {
  beforeEach(() => _resetImageCacheForTests());

  it('matches an image node (wins over the rect fallback)', () => {
    expect(findNodeShape(imageNode('a'))?.id).toBe('kit:image');
  });

  it('paints a placeholder path while the bitmap is not ready', () => {
    __setImageLoaderForTests(() => new Promise<ImageBitmap>(() => {}));
    const painter = findNodeShape(imageNode('a'))!;
    const cmds = painter.paint(imageNode('a'), POSE);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].kind).toBe('path');
  });

  it('paints an ImageDrawCommand once the bitmap is ready', async () => {
    const bmp = fakeBitmap();
    __setImageLoaderForTests(async () => bmp);
    // Prime the cache: first read kicks off the load, then it resolves.
    expect(getImageBitmap('a')).toBeUndefined();
    await flush();
    expect(getImageBitmap('a')).toBe(bmp);

    const painter = findNodeShape(imageNode('a'))!;
    const cmds = painter.paint(imageNode('a'), POSE);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ kind: 'image', image: bmp, x: 10, y: 20, w: 30, h: 40 });
  });

  it('reports the pose rect as its silhouette', () => {
    expect(findShapeSilhouette(imageNode('a'), POSE)).toMatchObject({
      kind: 'rect', x: 10, y: 20, width: 30, height: 40,
    });
  });

  describe('NodePaintCtx.resolveImage', () => {
    it('uses the supplied resolver instead of the global cache', () => {
      const bmp = fakeBitmap();
      const painter = findNodeShape(imageNode('a'))!;
      const cmds = painter.paint(imageNode('a'), POSE, { resolveImage: () => bmp });
      expect(cmds).toHaveLength(1);
      expect(cmds[0]).toMatchObject({ kind: 'image', image: bmp, x: 10, y: 20, w: 30, h: 40 });
    });

    it('deterministic grey placeholder when the resolver returns undefined', async () => {
      // A supplied resolver is authoritative: no global-cache read, no ambient
      // load-status read — the fallback is always the single grey outline
      // (never the error variant, which depends on ambient state).
      // Prime src 'a' into ambient ERROR state first, so this test actually
      // proves the resolver bypasses the ambient read rather than merely
      // passing because the cache happens to be in a non-error state.
      __setImageLoaderForTests(() => Promise.reject(new Error('boom')));
      getImageBitmap('a');
      await flush();

      const painter = findNodeShape(imageNode('a'))!;
      const cmds = painter.paint(imageNode('a'), POSE, { resolveImage: () => undefined });
      expect(cmds).toHaveLength(1);
      expect(cmds[0]).toMatchObject({
        kind: 'path',
        path: { kind: 'rect', x: 10, y: 20, width: 30, height: 40 },
        stroke: { paint: { color: '#bbbbbb' }, width: 1 },
      });
    });
  });

  describe('source rect and flip', () => {
    const bitmap = (width: number, height: number): ImageBitmap =>
      ({ width, height, close() {} } as unknown as ImageBitmap);
    const paint = (extra: Omit<ImageNodeData['image'], 'src'>, bmp = bitmap(200, 100)) =>
      findNodeShape(imageNode('a', extra))!.paint(imageNode('a', extra), POSE, {
        resolveImage: () => bmp,
      });

    it('omits source and flips from the command when the data has none', () => {
      const [cmd] = paint({});
      expect(cmd).not.toHaveProperty('source');
      expect(cmd).not.toHaveProperty('flipX');
      expect(cmd).not.toHaveProperty('flipY');
    });

    it('scales a fractional source rect to the decoded bitmap', () => {
      const [cmd] = paint({ source: { x: 0.25, y: 0.5, width: 0.5, height: 0.25 } });
      expect(cmd).toMatchObject({
        kind: 'image', x: 10, y: 20, w: 30, h: 40,
        source: { x: 50, y: 50, w: 100, h: 25 },
      });
    });

    it('passes the flips through', () => {
      expect(paint({ flipX: true })[0]).toMatchObject({ flipX: true });
      expect(paint({ flipY: true })[0]).toMatchObject({ flipY: true });
    });

    it('reaches the quad as UVs over the source window, mirrored, with the quad on the pose', () => {
      const recorder = makeGLRecorder();
      const r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
      recorder.reset();
      r.render(paint({
        source: { x: 0.25, y: 0.5, width: 0.5, height: 0.25 }, flipX: true,
      }));
      const upload = recorder.calls.find(
        (c) => c.name === 'bufferSubData'
          && c.args[2] instanceof Float32Array
          && (c.args[2] as Float32Array).length >= FLOATS_PER_VERTEX * 4,
      );
      if (!upload) throw new Error('no image quad upload recorded');
      const v = upload.args[2] as Float32Array;
      const UV = 6;
      const br = 2 * FLOATS_PER_VERTEX;
      // Top-left and bottom-right corners: position, then UV.
      expect([v[0], v[1], v[br], v[br + 1]]).toEqual([10, 20, 40, 60]);
      expect([v[UV], v[UV + 1], v[br + UV], v[br + UV + 1]]).toEqual([0.75, 0.5, 0.25, 0.75]);
    });
  });
});
