import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { viewToTransform, type RectPose } from '@weasel-js/core';
import { registerCanvasFont } from '@weasel-js/font';
import { fitDiagram } from '../DiagramView';
import { diagramScene } from '../fromData';
import { EFFECT_MIN_SCALE } from './EffectChart';
import { EffectEditor } from './EffectEditor';
import { editorScene } from './editorMapping';
import type { EffectDoc, EffectStage } from './types';

registerCanvasFont('sans-serif');

const stage = (id: string): EffectStage => ({ id, title: id, inputs: [{ id: 'in', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] });
const DOC: EffectDoc = {
  pipeline: { stages: [stage('blur'), stage('mix')], wires: [], groups: [{ id: 'g', label: 'Filters', members: ['blur'] }] },
  places: { blur: { x: 40, y: 60 }, mix: { x: 460, y: 60 } },
  groupBoxes: { g: { x: 0, y: 0, width: 360, height: 240 } },
};
const SIZE = { width: 800, height: 400 };

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Where world point `p` is drawn, in CSS pixels on the canvas, fitted the way the editor first fits `DOC`. */
function toScreen(p: { x: number; y: number }) {
  const { data, scene } = editorScene(DOC);
  const t = viewToTransform(fitDiagram(diagramScene(data, scene), SIZE, { anchor: 'start', minScale: EFFECT_MIN_SCALE })!);
  return { x: t.panX + p.x * t.zoom.x, y: t.panY + p.y * t.zoom.y };
}

function poseOf(id: string): RectPose {
  const { data, scene } = editorScene(DOC);
  return diagramScene(data, scene).find((s) => s.id === id)!.pose as RectPose;
}

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

async function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const changes: [EffectDoc, string][] = [];
  function Host() {
    const [doc, setDoc] = useState(DOC);
    const [group, setGroup] = useState<string | null>(null);
    return (
      <EffectEditor
        doc={doc} selectedGroup={group} onSelectGroup={setGroup} {...SIZE}
        onChange={(next, label) => { changes.push([next, label]); setDoc(next); }}
      />
    );
  }
  await act(async () => {
    root = createRoot(host);
    root.render(<Host />);
  });
  await frame();
  await frame();
  const canvas = host.querySelector('canvas')!;
  const fire = (type: string, at: { x: number; y: number }) => {
    const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: r.left + at.x, clientY: r.top + at.y,
    }));
  };
  const drag = async (fromWorld: { x: number; y: number }, toWorld: { x: number; y: number }) => {
    const from = toScreen(fromWorld);
    const to = toScreen(toWorld);
    await act(async () => {
      fire('pointermove', from);
      fire('pointerdown', from);
      for (let i = 1; i <= 10; i++) fire('pointermove', { x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10 });
      fire('pointerup', to);
    });
    await frame();
    await frame();
  };
  const click = async (world: { x: number; y: number }) => {
    const at = toScreen(world);
    await act(async () => {
      fire('pointermove', at);
      fire('pointerdown', at);
      fire('pointerup', at);
    });
    await frame();
  };
  const doubleClick = async (world: { x: number; y: number }) => {
    await click(world);
    await click(world);
    const at = toScreen(world);
    const r = canvas.getBoundingClientRect();
    await act(async () => {
      canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + at.x, clientY: r.top + at.y, detail: 2 }));
    });
    await frame();
  };
  return { host, changes, drag, click, doubleClick };
}

describe('<EffectEditor> groups under nodeGraph', () => {
  it('moves a stage dragged into a group box into the group, as one Move', async () => {
    const { changes, drag } = await mount();
    const mix = poseOf('mix');
    await drag({ x: mix.x + mix.width / 2, y: mix.y + 10 }, { x: 200, y: 150 });
    await expect.poll(() => changes.length).toBe(1);
    const [next, label] = changes[0]!;
    expect(label).toBe('Move');
    expect(next.pipeline.groups).toEqual([{ id: 'g', label: 'Filters', members: ['blur', 'mix'] }]);
  });

  it('resizes a picked group by its corner handle, as one Resize group', async () => {
    const { changes, click, drag } = await mount();
    await click({ x: 180, y: 12 });
    await drag({ x: 360, y: 240 }, { x: 420, y: 300 });
    await expect.poll(() => changes.length).toBe(1);
    const [next, label] = changes[0]!;
    expect(label).toBe('Resize group');
    const box = next.groupBoxes!.g!;
    expect([box.x, box.y]).toEqual([0, 0]);
    expect(box.width).toBeCloseTo(420, 0);
    expect(box.height).toBeCloseTo(300, 0);
  });

  it('carries the stages inside a dragged group box, as one Move', async () => {
    const { changes, drag } = await mount();
    await drag({ x: 300, y: 220 }, { x: 340, y: 250 });
    await expect.poll(() => changes.length).toBe(1);
    const [next, label] = changes[0]!;
    expect(label).toBe('Move');
    expect(next.groupBoxes!.g).toMatchObject({ width: 360, height: 240 });
    const moved = { x: next.groupBoxes!.g!.x, y: next.groupBoxes!.g!.y };
    expect(moved.x).toBeGreaterThan(20);
    expect(next.places.blur).toEqual({ x: 40 + moved.x, y: 60 + moved.y });
    expect(next.places.mix).toEqual(DOC.places.mix);
  });

  it('renames a group from a field opened by double-clicking its title', async () => {
    const { host, changes, doubleClick } = await mount();
    await doubleClick({ x: 180, y: 12 });
    const field = await expect.poll(() => host.querySelector<HTMLInputElement>('input[aria-label="Group name"]')).not.toBeNull()
      .then(() => host.querySelector<HTMLInputElement>('input[aria-label="Group name"]')!);
    expect(document.activeElement).toBe(field);
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(field, 'Blurs');
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await expect.poll(() => changes.length).toBe(1);
    const [next, label] = changes[0]!;
    expect(label).toBe('Rename group');
    expect(next.pipeline.groups).toEqual([{ id: 'g', label: 'Blurs', members: ['blur'] }]);
    expect(host.querySelector('input[aria-label="Group name"]')).toBeNull();
  });
});
