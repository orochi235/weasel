import { act } from '@testing-library/react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { viewToTransform, type RectPose } from '@weasel-js/core';
import { registerCanvasFont } from '@weasel-js/font';
import { fitDiagram } from '../DiagramView';
import { diagramScene } from '../fromData';
import { portsOf } from '../ports';
import { EFFECT_MIN_SCALE } from './EffectChart';
import { EffectEditor } from './EffectEditor';
import { editorScene } from './editorMapping';
import type { EffectDoc } from './types';

registerCanvasFont('sans-serif');

const DOC: EffectDoc = {
  pipeline: {
    stages: [
      { id: 'blur', title: 'Blur', inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] },
      { id: 'mix', title: 'Mix', inputs: [{ id: 'base', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] },
    ],
    wires: [],
  },
  places: { blur: { x: 0, y: 0 }, mix: { x: 300, y: 0 } },
};
const SIZE = { width: 600, height: 300 };

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const fire = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));

/** A port's point in CSS pixels on the canvas, fitted the way the editor fits. */
function portOnScreen(stage: string, port: string) {
  const { data, scene } = editorScene(DOC);
  const specs = diagramScene(data, scene);
  const t = viewToTransform(fitDiagram(specs, SIZE, { anchor: 'start', minScale: EFFECT_MIN_SCALE })!);
  const s = specs.find((x) => x.id === stage)!;
  const p = portsOf({ id: stage, kind: s.kind, data: s.data }, s.pose as RectPose).find((x) => x.id === port)!;
  return { x: t.panX + p.point.x * t.zoom.x, y: t.panY + p.point.y * t.zoom.y };
}

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe('<EffectEditor>', () => {
  it('turns a drag from an output onto a compatible input into one Connect', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const onChange = vi.fn();
    await act(async () => {
      root = createRoot(host);
      root.render(<EffectEditor doc={DOC} onChange={onChange} {...SIZE} />);
    });
    await frame();
    await frame();
    const canvas = host.querySelector('canvas')!;
    const { left, top } = canvas.getBoundingClientRect();
    const from = portOnScreen('blur', 'out');
    const to = portOnScreen('mix', 'base');
    await act(async () => {
      fire(canvas, 'pointerdown', left + from.x, top + from.y);
      for (let i = 1; i <= 10; i++) {
        fire(canvas, 'pointermove', left + from.x + (to.x - from.x) * i / 10, top + from.y + (to.y - from.y) * i / 10);
      }
      fire(canvas, 'pointerup', left + to.x, top + to.y);
    });
    await expect.poll(() => onChange.mock.calls.length).toBe(1);
    const [next, label] = onChange.mock.calls[0]!;
    expect(label).toBe('Connect');
    expect(next.pipeline.wires).toEqual([{ id: 'w1', from: { stage: 'blur', port: 'out' }, to: { stage: 'mix', port: 'base' } }]);
  });
});
