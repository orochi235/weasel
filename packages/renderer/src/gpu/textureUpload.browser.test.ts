/**
 * What an image upload stores, read back from the texture on both backends:
 * `premultiply` decides premultiplied or straight texels, whatever the source
 * holds, including a bitmap made with `premultiplyAlpha: 'none'`.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parityDevice, releaseDevice, requireGpu } from '@weasel-js/renderer/testing/parityHarness';
import type { GpuDevice, GpuImageSource, GpuTexture } from './types';
import { WebGLDevice } from './webgl/WebGLDevice';
import type { GlTexture } from './webgl/glResources';
import { BufferUsage, MapMode } from './webgpu/flags';
import { openWebGPU } from './webgpu/openWebGPU';
import type { WgpuTexture } from './webgpu/wgpuResources';

const SIDE = 8;
/** Half-transparent orange: unequal channels, so a swapped or twice-multiplied one reads as itself. */
const STRAIGHT = [255, 128, 0, 128] as const;
const PREMULTIPLIED = [128, 64, 0, 128] as const;
/** A source that went through a 2D canvas, which keeps premultiplied bytes, is a unit or two off. */
const SLACK = 3;
const SAMPLING = { min: 'nearest', mag: 'nearest', wrapS: 'clamp', wrapT: 'clamp' } as const;

function pixels(): ImageData {
  const data = new ImageData(SIDE, SIDE);
  for (let p = 0; p < data.data.length; p += 4) data.data.set(STRAIGHT, p);
  return data;
}

function canvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SIDE;
  c.getContext('2d')!.putImageData(pixels(), 0, 0);
  return c;
}

const png = () => new Promise<Blob>((done) => canvas().toBlob((blob) => done(blob!), 'image/png'));

const SOURCES: Record<string, () => Promise<GpuImageSource>> = {
  'ImageData': async () => pixels(),
  'a canvas': async () => canvas(),
  'a default bitmap': () => createImageBitmap(pixels()),
  'a straight bitmap': () => createImageBitmap(pixels(), { premultiplyAlpha: 'none' }),
  'a premultiplied bitmap': () => createImageBitmap(pixels(), { premultiplyAlpha: 'premultiply' }),
  'a PNG bitmap': async () => createImageBitmap(await png()),
};

interface Backend {
  readonly device: GpuDevice;
  read(texture: GpuTexture): Promise<number[]>;
  close(): void;
}

function openGl(): Backend {
  const gl = document.createElement('canvas').getContext('webgl2', { stencil: true })!;
  const device = new WebGLDevice(gl);
  return {
    device,
    async read(texture) {
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, (texture as GlTexture).handle, 0);
      const px = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fb);
      return Array.from(px);
    },
    close: () => gl.getExtension('WEBGL_lose_context')?.loseContext(),
  };
}

async function openGpu(): Promise<Backend> {
  const gpu = await parityDevice();
  const { device } = openWebGPU({ device: gpu, canvas: document.createElement('canvas'), antialias: false });
  return {
    device,
    async read(texture) {
      const buffer = gpu.createBuffer({ size: 256, usage: BufferUsage.COPY_DST | BufferUsage.MAP_READ });
      const encoder = gpu.createCommandEncoder();
      encoder.copyTextureToBuffer({ texture: (texture as WgpuTexture).gpu }, { buffer, bytesPerRow: 256 }, [1, 1]);
      gpu.queue.submit([encoder.finish()]);
      await buffer.mapAsync(MapMode.READ);
      const px = Array.from(new Uint8Array(buffer.getMappedRange(0, 4)));
      buffer.destroy();
      return px;
    },
    close: () => device.dispose?.(),
  };
}

const open: Backend[] = [];

afterAll(() => releaseDevice());
beforeEach(requireGpu);
afterEach(() => {
  for (const b of open.splice(0)) b.close();
});

function expectNear(got: number[], want: readonly number[], label: string): void {
  got.forEach((channel, i) => {
    expect(Math.abs(channel - want[i]), `${label}: channel ${i} of [${got}], wanted [${want}]`).toBeLessThanOrEqual(SLACK);
  });
}

describe('an image texture upload', () => {
  for (const [name, make] of Object.entries(SOURCES)) {
    it(`stores ${name} straight or premultiplied as asked, on both backends`, async () => {
      const backends = { webgl: openGl(), webgpu: await openGpu() };
      open.push(backends.webgl, backends.webgpu);
      for (const [backend, b] of Object.entries(backends)) {
        for (const premultiply of [false, true]) {
          const texture = b.device.createTexture('rgba8', SAMPLING, { source: await make(), premultiply });
          expectNear(await b.read(texture), premultiply ? PREMULTIPLIED : STRAIGHT, `${backend}, premultiply ${premultiply}`);
          b.device.deleteTexture(texture);
        }
      }
    });
  }
});
