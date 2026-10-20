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
import type { LanesOptions } from './lanes';
import { wireEnds } from './lookRoutes';
import { mainChain } from './mainChain';
import { io, w } from './skipFixture';
import type { EffectDoc } from './types';

registerCanvasFont('sans-serif');

const DOC: EffectDoc = {
  pipeline: {
    stages: [io('a', { inputs: [] }), io('b'), io('c')],
    wires: [{ id: 'w1', ...w(['a', 'out'], ['b', 'in']) }, { id: 'w2', ...w(['b', 'out'], ['c', 'in']) }],
  },
  places: {},
};
const OPTIONS: LanesOptions = { router: 'orthogonal' };
const SIZE = { width: 720, height: 300 };

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const fire = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));

/** World to canvas CSS pixels, fitted the way the editor fits, with w2's
 *  middle, a stage's center, and the lane order's gaps as drawn. */
function drawn() {
  const built = editorScene(DOC, 'lanes', OPTIONS);
  const specs = diagramScene(built.data, built.scene);
  const t = viewToTransform(fitDiagram(specs, SIZE, { anchor: 'start', minScale: EFFECT_MIN_SCALE })!);
  const screen = (p: { x: number; y: number }) => ({ x: t.panX + p.x * t.zoom.x, y: t.panY + p.y * t.zoom.y });
  const box = (id: string) => specs.find((s) => s.id === id)!.pose as RectPose;
  const [p, q] = wireEnds(specs, 'w2')!;
  const slots = sequenceSlots('x', built.order!.items.map(({ id }) => ({ id, bounds: box(id) })));
  return {
    straight: p.y === q.y,
    middle: screen({ x: (p.x + q.x) / 2, y: p.y }),
    center: (id: string) => screen({ x: box(id).x + box(id).width / 2, y: box(id).y + box(id).height / 2 }),
    gap: (k: number) => screen({ x: slots.gaps[k]!.a.x, y: (slots.gaps[k]!.a.y + slots.gaps[k]!.b.y) / 2 }),
  };
}

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

async function drag(canvas: HTMLCanvasElement, from: { x: number; y: number }, to: { x: number; y: number }) {
  const { left, top } = canvas.getBoundingClientRect();
  await act(async () => { fire(canvas, 'pointermove', left + from.x, top + from.y); });
  await act(async () => {
    fire(canvas, 'pointerdown', left + from.x, top + from.y);
    for (let i = 1; i <= 10; i++) fire(canvas, 'pointermove', left + from.x + (to.x - from.x) * i / 10, top + from.y + (to.y - from.y) * i / 10);
  });
  await frame();
  await act(async () => { fire(canvas, 'pointerup', left + to.x, top + to.y); });
  await frame();
}

describe('<EffectEditor look="lanes"> route editing', () => {
  it('reroutes a wire by a segment drag, and a reorder that takes the wire away drops the route', async () => {
    const onChange = vi.fn();
    const host = document.createElement('div');
    document.body.append(host);
    const render = (doc: EffectDoc) => act(async () => {
      root ??= createRoot(host);
      root.render(<EffectEditor doc={doc} onChange={onChange} look="lanes" options={OPTIONS} {...SIZE} />);
    });
    await render(DOC);
    await frame();
    await frame();
    const canvas = host.querySelector('canvas')!;
    const { straight, middle, center, gap } = drawn();
    expect(straight).toBe(true);

    const { left, top } = canvas.getBoundingClientRect();
    await act(async () => {
      fire(canvas, 'pointerdown', left + middle.x, top + middle.y);
      fire(canvas, 'pointerup', left + middle.x, top + middle.y);
    });
    await frame();
    await frame();
    await drag(canvas, middle, { x: middle.x, y: middle.y + 30 });
    await expect.poll(() => onChange.mock.calls.length).toBe(1);
    const [routed, label] = onChange.mock.calls[0]! as [EffectDoc, string];
    expect(label).toBe('Edit route');
    expect(routed.lookRoutes?.lanes?.w2?.waypoints.length).toBeGreaterThan(0);
    expect(routed.routes).toBeUndefined();

    await render(routed);
    await frame();
    await drag(canvas, center('c'), { x: gap(1).x, y: center('c').y });
    await expect.poll(() => onChange.mock.calls.length).toBe(2);
    const [reordered, again] = onChange.mock.calls[1]! as [EffectDoc, string];
    expect(again).toBe('Reorder');
    expect(mainChain(reordered.pipeline)).toEqual(['a', 'c', 'b']);
    expect(reordered.lookRoutes).toBeUndefined();
  });
});
