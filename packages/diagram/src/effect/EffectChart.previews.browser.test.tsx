import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { viewToTransform, type RectPose } from '@weasel-js/core';
import { registerCanvasFont } from '@weasel-js/font';
import { fitDiagram } from '../DiagramView';
import { diagramScene } from '../fromData';
import { previewRowId } from './draw';
import { EffectChart } from './EffectChart';
import { nodeGraph } from './nodeGraph';
import type { EffectPipeline, EffectRun } from './types';

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
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })!;
  const px = new Uint8Array(4);
  gl.readPixels(x, canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return [...px];
}

/** Counts each texture upload of `source`. */
function uploadsOf(source: object): { count: number; restore: () => void } {
  const proto = WebGL2RenderingContext.prototype;
  const original = proto.texImage2D;
  const seen = { count: 0, restore: () => { proto.texImage2D = original; } };
  proto.texImage2D = function (this: WebGL2RenderingContext, ...args: unknown[]) {
    if (args[args.length - 1] === source) seen.count++;
    return (original as (...a: unknown[]) => void).apply(this, args);
  } as unknown as typeof original;
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
