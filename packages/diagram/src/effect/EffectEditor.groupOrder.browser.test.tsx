import { act } from '@testing-library/react';
import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { viewToTransform, type RectPose } from '@weasel-js/core';
import { registerCanvasFont } from '@weasel-js/font';
import { groupLabelIdOf } from '../dataGroups';
import { fitDiagram } from '../DiagramView';
import { diagramScene } from '../fromData';
import { EFFECT_MIN_SCALE } from './EffectChart';
import { EffectEditor } from './EffectEditor';
import { editorScene } from './editorMapping';
import { mainChain } from './mainChain';
import type { EffectDoc, EffectStage } from './types';

registerCanvasFont('sans-serif');

const img = (id: string): EffectStage => ({
  id, title: id, inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }],
});
const CHAIN = ['src', 'a', 'b', 'c', 'out'];
const DOC: EffectDoc = {
  pipeline: {
    stages: [
      { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
      img('a'),
      img('b'),
      img('c'),
      { id: 'out', title: 'Out', kind: 'sink', inputs: [{ id: 'in', type: 'image' }] },
    ],
    wires: CHAIN.slice(1).map((id, k) => ({
      id: `w${k + 1}`, from: { stage: CHAIN[k]!, port: 'out' }, to: { stage: id, port: id === 'out' ? 'in' : 'image' },
    })),
    groups: [{ id: 'g', label: 'Pair', members: ['a', 'b'] }],
  },
  places: {},
};
const SIZE = { width: 900, height: 360 };
type Look = 'rack' | 'lanes';

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Each node's drawn box, and world to canvas CSS pixels, fitted the way the editor fits `DOC` under `look`. */
function drawn(look: Look) {
  const built = editorScene(DOC, look);
  const specs = diagramScene(built.data, built.scene);
  const t = viewToTransform(fitDiagram(specs, SIZE, { anchor: 'start', minScale: EFFECT_MIN_SCALE })!);
  const box = (id: string) => specs.find((s) => s.id === id)!.pose as RectPose;
  const screen = (p: { x: number; y: number }) => ({ x: t.panX + p.x * t.zoom.x, y: t.panY + p.y * t.zoom.y });
  const center = (id: string) => screen({ x: box(id).x + box(id).width / 2, y: box(id).y + box(id).height / 2 });
  return { box, screen, center };
}

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

async function mount(look: Look, initial: EffectDoc = DOC) {
  const host = document.createElement('div');
  document.body.append(host);
  const changes: [EffectDoc, string][] = [];
  function Host() {
    const [doc, setDoc] = useState(initial);
    return <EffectEditor doc={doc} look={look} {...SIZE} onChange={(next, label) => { changes.push([next, label]); setDoc(next); }} />;
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
  const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await act(async () => {
      fire('pointermove', from);
      fire('pointerdown', from);
      for (let i = 1; i <= 10; i++) fire('pointermove', { x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10 });
    });
    await frame();
    await act(async () => { fire('pointerup', to); });
    await frame();
  };
  // Both clicks in one task, so a frame awaited between them cannot outlast the double-click window.
  const doubleClick = async (at: { x: number; y: number }) => {
    const r = canvas.getBoundingClientRect();
    await act(async () => {
      fire('pointermove', at);
      for (let i = 0; i < 2; i++) {
        fire('pointerdown', at);
        fire('pointerup', at);
      }
      canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + at.x, clientY: r.top + at.y, detail: 2 }));
    });
    await frame();
  };
  const field = () => host.querySelector<HTMLInputElement>('input[aria-label="Group name"]');
  const type = async (text: string) => {
    const input = field()!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
  };
  return { changes, drag, doubleClick, field, type };
}

describe('<EffectEditor> group reorder', () => {
  it.each(['rack', 'lanes'] as const)('drags a group by its title past the next stage under %s', async (look) => {
    const { changes, drag } = await mount(look);
    const { box, screen, center } = drawn(look);
    const from = center(groupLabelIdOf('g'));
    const [g, c] = [box('g'), box('c')];
    // Far enough that the group's middle, not the press, passes c's far edge.
    const by = screen({ x: c.x + c.width + 4, y: 0 }).x - screen({ x: g.x + g.width / 2, y: 0 }).x;
    await drag(from, { x: from.x + by, y: from.y });
    await expect.poll(() => changes.length).toBe(1);
    expect(changes[0]![1]).toBe('Reorder group');
    expect(mainChain(changes[0]![0].pipeline)).toEqual(['src', 'c', 'a', 'b', 'out']);
  });

  it('leaves a stage drag on a member as a stage drag', async () => {
    const { changes, drag } = await mount('rack');
    const { box, screen, center } = drawn('rack');
    const from = center('a');
    const past = (id: string) => ({ x: screen({ x: box(id).x + box(id).width + 4, y: 0 }).x, y: from.y });
    await drag(from, past('c'));
    await frame();
    expect(changes).toEqual([]);
    await drag(from, past('b'));
    await expect.poll(() => changes.length).toBe(1);
    expect(changes[0]![1]).toBe('Reorder');
    expect(mainChain(changes[0]![0].pipeline)).toEqual(['src', 'b', 'a', 'c', 'out']);
  });
});

describe('<EffectEditor> group rename under rack and lanes', () => {
  it.each(['rack', 'lanes'] as const)('renames a group from a field opened by double-clicking its title under %s', async (look) => {
    const { changes, doubleClick, field, type } = await mount(look);
    await doubleClick(drawn(look).center(groupLabelIdOf('g')));
    await expect.poll(field).not.toBeNull();
    expect(document.activeElement).toBe(field());
    await type('Duo');
    await expect.poll(() => changes.length).toBe(1);
    expect(changes.at(-1)![1]).toBe('Rename group');
    expect(changes.at(-1)![0].pipeline.groups).toEqual([{ id: 'g', label: 'Duo', members: ['a', 'b'] }]);
    expect(field()).toBeNull();
  });

  it('renames an unlabeled group from its top band under rack', async () => {
    const bare: EffectDoc = { ...DOC, pipeline: { ...DOC.pipeline, groups: [{ id: 'g', members: ['a', 'b'] }] } };
    const { changes, doubleClick, field, type } = await mount('rack', bare);
    const built = editorScene(bare, 'rack');
    const specs = diagramScene(built.data, built.scene);
    const t = viewToTransform(fitDiagram(specs, SIZE, { anchor: 'start', minScale: EFFECT_MIN_SCALE })!);
    const box = (id: string) => specs.find((s) => s.id === id)!.pose as RectPose;
    const [g, a] = [box('g'), box('a')];
    expect(a.y).toBeGreaterThan(g.y);
    const world = { x: a.x + a.width / 2, y: (g.y + a.y) / 2 };
    await doubleClick({ x: t.panX + world.x * t.zoom.x, y: t.panY + world.y * t.zoom.y });
    await expect.poll(field).not.toBeNull();
    await type('New');
    await expect.poll(() => changes.length).toBe(1);
    expect(changes[0]![1]).toBe('Rename group');
    expect(changes[0]![0].pipeline.groups).toEqual([{ id: 'g', label: 'New', members: ['a', 'b'] }]);
  });

  it('opens nothing on a double-click on a stage body', async () => {
    const { changes, doubleClick, field } = await mount('rack');
    await doubleClick(drawn('rack').center('a'));
    await frame();
    await frame();
    expect(field()).toBeNull();
    expect(changes).toEqual([]);
  });
});
