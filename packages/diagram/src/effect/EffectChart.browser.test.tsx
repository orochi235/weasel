import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { registerCanvasFont } from '@weasel-js/font';
import { EffectChart } from './EffectChart';
import { rack } from './rack';
import type { EffectPipeline } from './types';

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
  const gl = canvas.getContext('webgl2')!;
  const px = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) n++;
  return n;
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
    const { container } = render(<EffectChart pipeline={P} look={rack} width={480} height={320} />);
    await frame();
    await frame();
    expect(inked(container.querySelector('canvas')!)).toBeGreaterThan(500);
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
