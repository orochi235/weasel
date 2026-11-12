import { act, renderHook } from '@testing-library/react';
import { getImageBitmap } from '@weasel-js/core';
import { __setImageLoaderForTests, _resetImageCacheForTests } from '@weasel-js/renderer/test-seams';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SLOT_FRAME, diagramScene, type DataNode } from './fromData';
import { imagesNeeded, useHeldImages, useReleasedImages, withPreviousImages } from './imageRelease';

const released = vi.hoisted(() => [] as string[]);
vi.mock('@weasel-js/core', async (original) => ({
  ...(await original<typeof import('@weasel-js/core')>()),
  releaseImage: (src: string) => { released.push(src); },
}));
afterEach(() => { released.length = 0; });

const SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"/%3E';
const node = (rows: DataNode['rows']): DataNode => ({ id: 'n', at: { x: 0, y: 0 }, width: 100, padding: 8, gap: 4, verticalAlign: 'top', rows });
const childrenOf = (specs: ReturnType<typeof diagramScene>) => specs.filter((s) => s.parent === ('n' as never));

describe('a slot row with an image', () => {
  it('is drawn as that image in the slot\'s box, with no id needed', () => {
    const specs = diagramScene({ nodes: [node([{ kind: 'slot', height: 48, width: 48, image: { src: SRC, opacity: 0.5 } }])], edges: [] }, { layout: 'none' });
    const [slot] = childrenOf(specs);
    expect(slot!.data).toEqual({ image: { src: SRC, opacity: 0.5 } });
    expect(slot!.pose).toMatchObject({ x: 8 + (84 - 48) / 2, y: 8, width: 48, height: 48 });
    expect(slot!.pickable).toBe(false);
  });

  it('leaves a slot without one as it was: a frame with an id, nothing without', () => {
    const framed = childrenOf(diagramScene({ nodes: [node([{ kind: 'slot', height: 20, id: 's' }])], edges: [] }, { layout: 'none' }));
    expect(framed[0]!.data).toMatchObject({ diagram: { mark: { d: SLOT_FRAME } } });
    expect(childrenOf(diagramScene({ nodes: [node([{ kind: 'slot', height: 20 }])], edges: [] }, { layout: 'none' }))).toHaveLength(0);
  });
});

describe('a swapped picture', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const spec = (src: string, previous?: string) => ({ id: 'n/0', data: { image: { src, ...(previous ? { previous } : {}) } } });
  let land: (b: ImageBitmap) => void = () => {};
  const bmp = { width: 2, height: 2, close() {} } as unknown as ImageBitmap;
  beforeEach(() => {
    _resetImageCacheForTests();
    __setImageLoaderForTests((src) => (src === 'b' ? new Promise<ImageBitmap>((r) => { land = r; }) : Promise.resolve(bmp)));
  });

  it('carries the last picture its node decoded as previous, and none for a node that never decoded one', async () => {
    expect(withPreviousImages([spec('b')], new Map([['n/0', { src: 'a' }]]))[0]!.data.image).toEqual({ src: 'b' });
    getImageBitmap('a');
    await flush();
    expect(withPreviousImages([spec('b')], new Map([['n/0', { src: 'a' }]]))[0]!.data.image).toEqual({ src: 'b', previous: 'a' });
    // Swapped again before `b` decoded: `a` is still the last picture shown.
    expect(withPreviousImages([spec('c')], new Map([['n/0', { src: 'b', previous: 'a' }]]))[0]!.data.image).toEqual({ src: 'c', previous: 'a' });
  });

  it('holds the old picture until the new one decodes, then frees it', async () => {
    const { result, rerender, unmount } = renderHook(({ specs }) => {
      const held = useHeldImages(specs);
      useReleasedImages(held);
      return held;
    }, { initialProps: { specs: [spec('a')] } });
    getImageBitmap('a');
    await flush();
    rerender({ specs: [spec('b')] });
    expect(result.current[0]!.data.image).toEqual({ src: 'b', previous: 'a' });
    getImageBitmap('b');
    await act(flush);
    expect(released).toEqual([]);
    await act(async () => { land(bmp); await flush(); });
    expect(released).toEqual(['a']);
    unmount();
  });

  it('frees the old picture once the new one fails, which the painter no longer draws it for', async () => {
    __setImageLoaderForTests((src) => (src === 'b' ? Promise.reject(new Error('gone')) : Promise.resolve(bmp)));
    const { rerender, unmount } = renderHook(({ specs }) => useReleasedImages(useHeldImages(specs)), {
      initialProps: { specs: [spec('a')] },
    });
    getImageBitmap('a');
    await act(flush);
    rerender({ specs: [spec('b')] });
    await act(async () => { getImageBitmap('b'); await flush(); });
    expect(released).toEqual(['a']);
    unmount();
  });
});

describe('useReleasedImages', () => {
  const specsWith = (...srcs: string[]) => srcs.map((src) => ({ data: { image: { src } } }));

  it('frees an image once the specs stop drawing it, and the rest on unmount', () => {
    const { rerender, unmount } = renderHook(({ specs }) => useReleasedImages(specs), { initialProps: { specs: specsWith('a', 'b') } });
    expect(released).toEqual([]);
    rerender({ specs: specsWith('b', 'c') });
    expect(released).toEqual(['a']);
    unmount();
    expect(released.sort()).toEqual(['a', 'b', 'c']);
  });

  it('reads the sources from specs that draw images, and no others', () => {
    expect([...imagesNeeded([{ data: { image: { src: 'x' } } }, { data: { text: 'y' } }, {}])]).toEqual(['x']);
    expect([...imagesNeeded([{ data: { image: { src: 'x', previous: 'p' } } }])]).toEqual(['x', 'p']);
  });
});
