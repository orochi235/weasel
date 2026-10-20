import type { DrawCommand } from '@weasel-js/renderer';
import { registerTexture, unregisterTexture } from '@weasel-js/renderer';
import { afterEach, describe, expect, it } from 'vitest';
import { latin1 } from './latin1';
import { NO_FONTS } from './testing/noFonts';
import { type RasterPixels, type WritePdfOptions, writePdf } from './writePdf';

const fakeImage = (width: number, height: number) => ({ width, height }) as unknown as ImageBitmap;

function pixels(width: number, height: number, alpha = 255): RasterPixels {
  const data = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  for (let i = 0; i < width * height; i++) data.set([10 * i, 20, 30, alpha], i * 4);
  return { width, height, data };
}

async function render(commands: DrawCommand[], alpha = 255, readPixels?: WritePdfOptions['readPixels']) {
  const { bytes, skipped } = await writePdf([{ width: 200, height: 100, commands }], {
    fonts: NO_FONTS,
    compress: false,
    readPixels: readPixels ?? ((img) => pixels(img.width, img.height, alpha)),
  });
  const s = latin1(bytes);
  const content = s.slice(s.indexOf('stream\n') + 7, s.indexOf('\nendstream'));
  return { s, content, skipped };
}

const image = (img: ImageBitmap, extra: Partial<Extract<DrawCommand, { kind: 'image' }>> = {}): DrawCommand => ({
  kind: 'image',
  image: img,
  x: 10,
  y: 20,
  w: 30,
  h: 40,
  ...extra,
});

describe('images', () => {
  it('embeds an image once however many times it is drawn', async () => {
    const img = fakeImage(2, 1);
    const { s, content } = await render([image(img), image(img, { x: 50 })]);
    expect(s.match(/\/Subtype \/Image/g)).toHaveLength(1);
    expect(content.match(/\/Im1 Do/g)).toHaveLength(2);
  });

  it('writes RGB and an SMask from the alpha channel', async () => {
    const img = fakeImage(2, 1);
    const opaque = await render([image(img)]);
    expect(opaque.s).toContain('/ColorSpace /DeviceRGB /BitsPerComponent 8');
    expect(opaque.s).not.toContain('/SMask');
    const clear = await render([image(img)], 100);
    expect(clear.s).toContain('/SMask');
    expect(clear.s).toContain('/ColorSpace /DeviceGray');
    expect(clear.s.match(/\/Subtype \/Image/g)).toHaveLength(2);
  });

  it('places the image over its rect, flipped back upright', async () => {
    const { content } = await render([image(fakeImage(2, 1))]);
    expect(content).toContain('30 0 0 -40 10 60 cm\n/Im1 Do');
  });

  it('draws a source sub-rect clipped to the destination', async () => {
    const { content } = await render([image(fakeImage(10, 10), { source: { x: 5, y: 0, w: 5, h: 10 } })]);
    expect(content).toContain('10 20 30 40 re');
    expect(content).toContain('W\nn');
    // 5 source pixels fill 30 points: the whole 10 pixel image is 60 wide, starting 30 left of x.
    expect(content).toContain('60 0 0 -40 -20 60 cm');
  });

  it('honors flipX and flipY and nearest sampling', async () => {
    const flipped = await render([image(fakeImage(2, 1), { flipX: true, flipY: true, sampling: 'nearest' })]);
    expect(flipped.content).toContain('-30 0 0 40 40 20 cm');
    expect(flipped.s).toContain('/Interpolate false');
    const smooth = await render([image(fakeImage(2, 1), { sampling: 'linear' })]);
    expect(smooth.s).toContain('/Interpolate true');
  });

  it('draws every sprite of a sprites command', async () => {
    const img = fakeImage(4, 4);
    const sprites = new Float32Array([0, 0, 10, 10, 0, 0, 2, 2, 0.5, 20, 0, 10, 10, 2, 2, -2, 2, 1]);
    const { s, content } = await render([{ kind: 'sprites', image: img, sprites }]);
    expect(content.match(/\/Im1 Do/g)).toHaveLength(2);
    expect(s).toContain('/ca 0.5');
    expect(s.match(/\/Subtype \/Image/g)).toHaveLength(1);
    // sw < 0 mirrors x: source columns 0..2 land in the dest rect right to left
    expect(content).toContain('-20 0 0 -20 30 10 cm');
  });

  it('skips an image whose pixels cannot be read instead of failing the document', async () => {
    const { content, skipped } = await render([image(fakeImage(2, 1))], 255, () => {
      throw new Error('no canvas');
    });
    expect(skipped).toEqual([{ kind: 'command', detail: 'image could not be read' }]);
    expect(content).not.toContain('Do');
  });

  it('folds opacity and group alpha into one constant alpha', async () => {
    const { s } = await render([{ kind: 'group', alpha: 0.5, children: [image(fakeImage(1, 1), { opacity: 0.5 })] }]);
    expect(s).toContain('/ca 0.25');
  });
});

describe('texture paint', () => {
  const handles: ReturnType<typeof registerTexture>[] = [];
  afterEach(() => {
    for (const h of handles.splice(0)) unregisterTexture(h);
  });

  it('tiles a texture paint with a PDF tiling pattern', async () => {
    const texture = registerTexture(fakeImage(4, 2));
    handles.push(texture);
    const { s, content, skipped } = await render([
      {
        kind: 'path',
        path: { kind: 'rect', x: 0, y: 0, width: 50, height: 50 },
        fill: { paint: { kind: 'texture', texture, units: 'local', origin: { x: 3, y: 5 }, transform: [2, 0, 0, 2] } },
      },
    ]);
    expect(skipped).toEqual([]);
    expect(s).toContain('/PatternType 1');
    expect(s).toContain('/BBox [0 0 4 2] /XStep 4 /YStep 2');
    // page flip, then the tile placed at its origin and scaled by its transform
    expect(s).toContain('/Matrix [2 0 0 -2 3 95]');
    expect(content).toContain('/Pattern cs');
    expect(content).toContain('/P1 scn');
    expect(s).toContain('/Subtype /Image');
  });

  const texturePath = (paint: object): DrawCommand => ({
    kind: 'path',
    path: { kind: 'rect', x: 0, y: 0, width: 50, height: 50 },
    fill: { paint: { kind: 'texture', texture: handles[0], ...paint } as never },
  });

  it('carries a group transform into the pattern matrix for local units', async () => {
    handles.push(registerTexture(fakeImage(4, 2)));
    const group: DrawCommand = {
      kind: 'group',
      transform: Float64Array.from([2, 0, 0, 0, 3, 0, 5, 6, 1]),
      children: [texturePath({ units: 'local', origin: { x: 3, y: 5 }, transform: [2, 0, 0, 2] })],
    };
    const { s } = await render([group]);
    expect(s).toContain('/Matrix [4 0 0 -6 11 79]');
  });

  it('ignores the group transform for page units', async () => {
    handles.push(registerTexture(fakeImage(4, 2)));
    const group: DrawCommand = {
      kind: 'group',
      transform: Float64Array.from([2, 0, 0, 0, 3, 0, 5, 6, 1]),
      children: [texturePath({ origin: { x: 3, y: 5 }, transform: [2, 0, 0, 2] })],
    };
    const { s } = await render([group]);
    expect(s).toContain('/Matrix [2 0 0 -2 3 95]');
  });

  it('skips a texture that is not registered', async () => {
    const { skipped } = await render([
      {
        kind: 'path',
        path: { kind: 'rect', x: 0, y: 0, width: 5, height: 5 },
        fill: { paint: { kind: 'texture', texture: { id: 'tex_missing' } } },
      },
    ]);
    expect(skipped).toHaveLength(1);
  });
});
