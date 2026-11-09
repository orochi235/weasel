/** An image drawn from a bitmap made at runtime is written as its pixels, since no other document can load its name. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bitmapSrc, releaseImage } from '@weasel-js/core';
import { parseSvg, serializeSvg, type SvgImageNode } from './index';

const PNG = 'data:image/png;base64,AAAA';
const VIEW = { viewBox: { x: 0, y: 0, width: 100, height: 100 } };
const bitmap = (width = 2, height = 2) => ({ width, height, close() {} }) as unknown as ImageBitmap;
const image = (href: string): SvgImageNode => ({ kind: 'image', href, x: 0, y: 0, width: 10, height: 10 });

/** A 2D canvas that hands back `PNG`, where jsdom has none. */
function stubCanvas(): { drawn: unknown[] } {
  const drawn: unknown[] = [];
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const el = create(tag);
    if (tag !== 'canvas') return el;
    const canvas = el as HTMLCanvasElement;
    canvas.getContext = (() => ({ drawImage: (b: unknown) => drawn.push(b) })) as never;
    canvas.toDataURL = () => PNG;
    return canvas;
  }) as typeof document.createElement);
  return { drawn };
}

const srcs: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const s of srcs.splice(0)) releaseImage(s);
});

describe('serializeSvg on a bitmapSrc image', () => {
  it('writes the bitmap as a PNG data URL, which parses back as the image', () => {
    const { drawn } = stubCanvas();
    const b = bitmap();
    const src = bitmapSrc(b);
    srcs.push(src);
    const warnings: string[] = [];
    const out = serializeSvg([image(src)], { ...VIEW, onWarn: (m) => warnings.push(m) });
    expect(drawn).toEqual([b]);
    expect(out).toContain(`href="${PNG}"`);
    expect(out).not.toContain('weasel-bitmap:');
    expect((parseSvg(out).nodes[0] as SvgImageNode).href).toBe(PNG);
    expect(warnings).toEqual([]);
  });

  it('keeps the name and warns where no canvas can draw it', () => {
    const src = bitmapSrc(bitmap());
    srcs.push(src);
    vi.spyOn(document, 'createElement').mockImplementation((() => {
      throw new Error('no DOM');
    }) as never);
    const warnings: string[] = [];
    const out = serializeSvg([image(src)], { ...VIEW, onWarn: (m) => warnings.push(m) });
    expect(out).toContain(`href="${src}"`);
    expect(warnings).toHaveLength(1);
  });

  it('keeps the name and warns for a closed bitmap', () => {
    stubCanvas();
    const src = bitmapSrc(bitmap(0, 0));
    srcs.push(src);
    const warnings: string[] = [];
    const out = serializeSvg([image(src)], { ...VIEW, onWarn: (m) => warnings.push(m) });
    expect(out).toContain(`href="${src}"`);
    expect(warnings).toHaveLength(1);
  });

  it('writes an image pattern drawn from one as a PNG data URL too', () => {
    stubCanvas();
    const src = bitmapSrc(bitmap());
    srcs.push(src);
    const out = serializeSvg([{
      kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'gradient', paint: { kind: 'image', src, width: 4, height: 4 } as never },
    }], VIEW);
    expect(out).toContain('<pattern');
    expect(out).toContain(`href="${PNG}"`);
    expect(out).not.toContain('weasel-bitmap:');
  });

  it('leaves a URL src alone, starting no load', () => {
    stubCanvas();
    const out = serializeSvg([image('photo.png')], VIEW);
    expect(out).toContain('href="photo.png"');
  });
});
