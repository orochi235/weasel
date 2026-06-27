import { describe, it, expect, beforeEach } from 'vitest';
import { findNodeShape, findShapeSilhouette } from './NodeShape';
import {
  __setImageLoaderForTests,
  _resetImageCacheForTests,
  getImageBitmap,
} from 'features/images/imageCache';
import type { Node } from 'core/scene/types';

const fakeBitmap = (): ImageBitmap =>
  ({ width: 2, height: 2, close() {} } as unknown as ImageBitmap);

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const POSE = { x: 10, y: 20, width: 30, height: 40 };

function imageNode(src: string): Node<unknown, string, unknown> {
  return {
    id: 'i1', kind: 'leaf', layer: 'default', parent: null,
    pose: POSE, data: { image: { src } },
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
});
