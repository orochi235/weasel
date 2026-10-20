import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { viewToTransform, type RectPose } from '@weasel-js/core';
import { registerCanvasFont } from '@weasel-js/font';
import { fitDiagram } from '../DiagramView';
import { diagramScene } from '../fromData';
import { sequenceSlots } from '../reorder';
import { EFFECT_MIN_SCALE } from './EffectChart';
import { EffectEditor } from './EffectEditor';
import { editorScene } from './editorMapping';
import { mainChain } from './mainChain';
import type { EffectDoc, EffectStage } from './types';
import { canvasGl } from '@weasel-js/core/testing/canvasPixels';

registerCanvasFont('sans-serif');

const img = (id: string): EffectStage => ({
  id, title: id, inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }],
});
const DOC: EffectDoc = {
  pipeline: {
    stages: [
      { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
      img('a'),
      img('b'),
      { id: 'out', title: 'Out', kind: 'sink', inputs: [{ id: 'in', type: 'image' }] },
    ],
    wires: [
      { id: 'w1', from: { stage: 'src', port: 'out' }, to: { stage: 'a', port: 'image' } },
      { id: 'w2', from: { stage: 'a', port: 'out' }, to: { stage: 'b', port: 'image' } },
      { id: 'w3', from: { stage: 'b', port: 'out' }, to: { stage: 'out', port: 'in' } },
    ],
  },
  places: {},
};
const SIZE = { width: 720, height: 300 };
const INSERT = [31, 143, 255];
const REFUSED = [255, 93, 93];

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const fire = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));

/** World to canvas CSS pixels, fitted the way the editor fits, and the rack's slots as drawn. */
function drawn() {
  const built = editorScene(DOC, 'rack');
  const specs = diagramScene(built.data, built.scene);
  const t = viewToTransform(fitDiagram(specs, SIZE, { anchor: 'start', minScale: EFFECT_MIN_SCALE })!);
  const box = (id: string) => specs.find((s) => s.id === id)!.pose as RectPose;
  const slots = sequenceSlots('x', built.order!.items.map(({ id }) => ({ id, bounds: box(id) })));
  const screen = (p: { x: number; y: number }) => ({ x: t.panX + p.x * t.zoom.x, y: t.panY + p.y * t.zoom.y });
  const center = (id: string) => screen({ x: box(id).x + box(id).width / 2, y: box(id).y + box(id).height / 2 });
  const gap = (k: number) => screen({ x: slots.gaps[k]!.a.x, y: (slots.gaps[k]!.a.y + slots.gaps[k]!.b.y) / 2 });
  return { center, gap };
}

function pixel(canvas: HTMLCanvasElement, at: { x: number; y: number }): number[] {
  const dpr = canvas.width / SIZE.width;
  const gl = canvasGl(canvas);
  const px = new Uint8Array(4);
  gl.readPixels(Math.round(at.x * dpr), canvas.height - 1 - Math.round(at.y * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return [...px].slice(0, 3);
}
const near = (a: readonly number[], b: readonly number[]) => a.every((v, i) => Math.abs(v - b[i]!) <= 24);

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

async function mount(onChange: (next: EffectDoc, label: string) => void): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
    root.render(<EffectEditor doc={DOC} onChange={onChange} look="rack" {...SIZE} />);
  });
  await frame();
  await frame();
  return host.querySelector('canvas')!;
}

/** Presses at `from` and moves in steps to `to`, leaving the pointer down. */
async function press(canvas: HTMLCanvasElement, from: { x: number; y: number }, to: { x: number; y: number }) {
  const { left, top } = canvas.getBoundingClientRect();
  await act(async () => {
    fire(canvas, 'pointerdown', left + from.x, top + from.y);
    for (let i = 1; i <= 10; i++) fire(canvas, 'pointermove', left + from.x + (to.x - from.x) * i / 10, top + from.y + (to.y - from.y) * i / 10);
  });
  await frame();
  await frame();
  return () => act(async () => { fire(canvas, 'pointerup', left + to.x, top + to.y); });
}

describe('<EffectEditor look="rack">', () => {
  it('draws the insertion bar at the gap a stage is dragged to, and splices it in there on release', async () => {
    const onChange = vi.fn();
    const canvas = await mount(onChange);
    const { center, gap } = drawn();
    const release = await press(canvas, center('a'), { x: gap(3).x, y: center('a').y });
    expect(near(pixel(canvas, gap(3)), INSERT), `bar pixel ${pixel(canvas, gap(3)).join(',')}`).toBe(true);
    await release();
    await expect.poll(() => onChange.mock.calls.length).toBe(1);
    const [next, label] = onChange.mock.calls[0]!;
    expect(label).toBe('Reorder');
    expect(mainChain(next.pipeline)).toEqual(['src', 'b', 'a', 'out']);
  });

  it('draws the bar refused where the splice cannot type-check, and changes nothing on release', async () => {
    const onChange = vi.fn();
    const canvas = await mount(onChange);
    const { center, gap } = drawn();
    const release = await press(canvas, center('b'), { x: gap(0).x, y: center('b').y });
    expect(near(pixel(canvas, gap(0)), REFUSED), `bar pixel ${pixel(canvas, gap(0)).join(',')}`).toBe(true);
    await release();
    await frame();
    expect(onChange).not.toHaveBeenCalled();
  });
});
