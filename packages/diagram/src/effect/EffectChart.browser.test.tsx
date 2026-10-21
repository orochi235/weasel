import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { cleanup, render, waitFor } from '@testing-library/react';
import { viewToTransform, type RectPose } from '@weasel-js/core';
import { registerCanvasFont } from '@weasel-js/font';
import { fitDiagram } from '../DiagramView';
import { diagramScene } from '../fromData';
import { portsOf } from '../ports';
import { EffectChart } from './EffectChart';
import { nodeGraph } from './nodeGraph';
import { rack } from './rack';
import type { EffectPipeline } from './types';
import { canvasGl } from '@weasel-js/core/testing/canvasPixels';

registerCanvasFont('sans-serif');
afterEach(cleanup);

const P: EffectPipeline = {
  stages: [
    { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
    { id: 'blur', title: 'Blur', inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] },
  ],
  wires: [{ from: { stage: 'src', port: 'out' }, to: { stage: 'blur', port: 'image' } }],
};
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** How many pixels of the canvas are not the clear color. */
function inked(canvas: HTMLCanvasElement): number {
  const gl = canvasGl(canvas);
  const px = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) n++;
  return n;
}

/** Every pixel of the canvas, RGBA. */
function pixels(canvas: HTMLCanvasElement): Uint8Array {
  const gl = canvasGl(canvas);
  const px = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}

/** Where `EffectChart` puts a world point on its canvas, in CSS pixels: the
 *  default look's scene, fitted the way the chart fits it. */
function onScreen(size: { width: number; height: number }) {
  const drawn = nodeGraph(P);
  const specs = diagramScene(drawn.data, drawn.scene);
  const t = viewToTransform(fitDiagram(specs, size, { anchor: 'start' })!);
  const at = (x: number, y: number) => ({ x: t.panX + x * t.zoom.x, y: t.panY + y * t.zoom.y });
  const stage = (id: string) => specs.find((s) => s.kind === 'container' && s.id === id)!;
  return { at, stage };
}

describe('<EffectChart>', () => {
  it('mounts a canvas of the size asked for and draws the pipeline on it', async () => {
    const { container } = render(<EffectChart pipeline={P} width={480} height={320} />);
    const canvas = container.querySelector('canvas')!;
    expect(canvas.getBoundingClientRect().width).toBe(480);
    await frame();
    await frame();
    expect(inked(canvas)).toBeGreaterThan(500);
  });

  it('draws with the look it is given', async () => {
    const drawn = async (look?: typeof rack) => {
      const { container, unmount } = render(<EffectChart pipeline={P} {...(look ? { look } : {})} width={480} height={320} />);
      await frame();
      await frame();
      const px = pixels(container.querySelector('canvas')!);
      unmount();
      return px;
    };
    const graph = await drawn();
    const racked = await drawn(rack);
    let differ = 0;
    for (let i = 0; i < graph.length; i += 4) {
      if (graph[i] !== racked[i] || graph[i + 1] !== racked[i + 1] || graph[i + 2] !== racked[i + 2] || graph[i + 3] !== racked[i + 3]) differ++;
    }
    expect(differ).toBeGreaterThan(500);
  });

  it('reports a pick of a stage, of a point beside its port, and of empty canvas', async () => {
    const size = { width: 480, height: 320 };
    const onSelect = vi.fn();
    const { container } = render(<EffectChart pipeline={P} {...size} onSelect={onSelect} />);
    const canvas = container.querySelector('canvas')!;
    await frame();
    await frame();
    const { at, stage } = onScreen(size);
    const blur = stage('blur');
    const box = blur.pose as RectPose;
    const port = portsOf({ id: 'blur', kind: blur.kind, data: blur.data }, box).find((p) => p.id === 'image')!;
    const nearPort = at(port.point.x, port.point.y);
    const middle = at(box.x + box.width / 2, box.y + box.height / 2);

    await userEvent.click(canvas, { position: { x: nearPort.x + 4, y: nearPort.y } });
    await waitFor(() => expect(onSelect.mock.lastCall).toEqual(['blur']));
    await userEvent.click(canvas, { position: { x: size.width - 4, y: size.height - 4 } });
    await waitFor(() => expect(onSelect.mock.lastCall).toEqual([null]));
    await userEvent.click(canvas, { position: middle });
    await waitFor(() => expect(onSelect.mock.lastCall).toEqual(['blur']));
  });

  it('reports what is wrong with the pipeline', async () => {
    const onProblems = vi.fn();
    const bad = { ...P, wires: [{ from: { stage: 'ghost', port: 'out' }, to: { stage: 'blur', port: 'image' } }] };
    render(<EffectChart pipeline={bad} width={480} height={320} onProblems={onProblems} />);
    await waitFor(() => expect(onProblems).toHaveBeenCalled());
    expect(onProblems.mock.lastCall![0].map((p: { kind: string }) => p.kind)).toEqual(['missing-stage']);
  });

  it('mounts an empty pipeline without throwing', () => {
    expect(() => render(<EffectChart pipeline={{ stages: [], wires: [] }} width={200} height={100} />)).not.toThrow();
  });
});
