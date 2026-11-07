import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { viewToTransform, type RectPose } from '@weasel-js/core';
import { registerCanvasFont } from '@weasel-js/font';
import { fitDiagram } from '@weasel-js/diagram';
import { diagramScene } from '@weasel-js/diagram';
import { previewRowId, EffectChart, nodeGraph } from '@weasel-js/diagram/effect';
import type { EffectPipeline, EffectRun } from './types';
import { canvasGl } from '@weasel-js/core/testing/canvasPixels';

registerCanvasFont('sans-serif');
afterEach(cleanup);

const P: EffectPipeline = {
  stages: [{ id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] }],
  wires: [],
};
const OPTIONS = { showPreviews: true };
const SIZE = { width: 320, height: 240 };
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const settle = async () => { await frame(); await frame(); };

function solid(color: string): ImageBitmap {
  const c = new OffscreenCanvas(8, 8);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 8, 8);
  return c.transferToImageBitmap();
}

/** The pixel at the middle of the preview slot, RGBA. */
function slotPixel(canvas: HTMLCanvasElement): number[] {
  const drawn = nodeGraph(P, OPTIONS);
  const specs = diagramScene(drawn.data, drawn.scene);
  const t = viewToTransform(fitDiagram(specs, SIZE, { anchor: 'start' })!);
  const box = specs.find((s) => s.id === `src/${previewRowId('out')}`)!.pose as RectPose;
  const dpr = canvas.width / SIZE.width;
  const x = Math.round((t.panX + (box.x + box.width / 2) * t.zoom.x) * dpr);
  const y = Math.round((t.panY + (box.y + box.height / 2) * t.zoom.y) * dpr);
  const gl = canvasGl(canvas);
  const px = new Uint8Array(4);
  gl.readPixels(x, canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return [...px];
}

/**
 * Counts each texture upload of `source`: straight to `texImage2D`, or, for an `ImageBitmap` on WebGL,
 * drawn first into the renderer's 2D scratch canvas to premultiply it.
 */
function uploadsOf(source: object): { count: number; restore: () => void } {
  const restores: (() => void)[] = [];
  const seen = { count: 0, restore: () => { for (const r of restores) r(); } };
  const hook = <P extends object>(proto: P, name: keyof P, at: (args: unknown[]) => unknown) => {
    const original = proto[name] as (...a: unknown[]) => unknown;
    proto[name] = function (this: unknown, ...args: unknown[]) {
      if (at(args) === source) seen.count++;
      return original.apply(this, args);
    } as P[keyof P];
    restores.push(() => { proto[name] = original as P[keyof P]; });
  };
  hook(WebGL2RenderingContext.prototype, 'texImage2D', (args) => args[args.length - 1]);
  hook(OffscreenCanvasRenderingContext2D.prototype, 'drawImage', (args) => args[0]);
  hook(CanvasRenderingContext2D.prototype, 'drawImage', (args) => args[0]);
  return seen;
}

const runOf = (out: ImageBitmap): EffectRun => ({ stages: { src: { previews: { out } } } });

describe('<EffectChart> previews', () => {
  it('draws a run\'s preview in its slot, and the next one in its place', async () => {
    const chart = (run: EffectRun) => <EffectChart pipeline={P} options={OPTIONS} run={run} {...SIZE} />;
    const { container, rerender } = render(chart(runOf(solid('#ff0000'))));
    const canvas = container.querySelector('canvas')!;
    await settle();
    expect(slotPixel(canvas).slice(0, 3)).toEqual([255, 0, 0]);
    rerender(chart(runOf(solid('#0000ff'))));
    await settle();
    expect(slotPixel(canvas).slice(0, 3)).toEqual([0, 0, 255]);
  });

  it('uploads a preview handed back in a new run once', async () => {
    const out = solid('#00ff00');
    const uploads = uploadsOf(out);
    try {
      const chart = (run: EffectRun) => <EffectChart pipeline={P} options={OPTIONS} run={run} {...SIZE} />;
      const { rerender } = render(chart(runOf(out)));
      await settle();
      for (let i = 0; i < 3; i++) {
        rerender(chart(runOf(out)));
        await settle();
      }
      expect(uploads.count).toBe(1);
    } finally {
      uploads.restore();
    }
  });
});
