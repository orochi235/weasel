/**
 * Sequence editing through a real canvas: each drag reports one edit of the
 * sequence's data and draws nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { registerCanvasFont } from '@weasel-js/font';
import { DiagramView, type DiagramViewProps } from './DiagramView';
import { findStep } from './sequence/edit';
import { SEQ_FIXTURE as data } from './sequence/fixture';
import { sequenceLayout } from './sequence/layout';
import { sequenceSpecs } from './sequence/specs';
import type { SequenceEdit } from './sequence/commit';

registerCanvasFont('sans-serif');

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const layout = sequenceLayout(data);

async function mount(extra: Partial<DiagramViewProps>): Promise<HTMLCanvasElement> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(DiagramView, {
    specs: sequenceSpecs(data, { id: 'seq' }), width: layout.width, height: layout.height, view: VIEW, onViewChange: () => {},
    ...extra,
  })));
  await frame();
  await frame();
  return host.querySelector('canvas')!;
}

function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number): void {
  const box = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: box.left + x, clientY: box.top + y,
  }));
}

async function drag(canvas: HTMLCanvasElement, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  pointer(canvas, 'pointermove', from.x, from.y);
  pointer(canvas, 'pointerdown', from.x, from.y);
  for (let i = 1; i <= 8; i++) {
    pointer(canvas, 'pointermove', from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8);
    await frame();
  }
  pointer(canvas, 'pointerup', to.x, to.y);
  await frame();
}

const edited = (fn: ReturnType<typeof vi.fn>): SequenceEdit => {
  expect(fn).toHaveBeenCalledTimes(1);
  return fn.mock.calls[0]![0] as SequenceEdit;
};

describe('sequence editing in DiagramView', () => {
  it('reports a message dragged to the top row', async () => {
    const onEditSequence = vi.fn();
    const canvas = await mount({ onEditSequence });
    const m5 = layout.messages.find((m) => m.id === 'm5')!;
    await drag(canvas, { x: (m5.x1 + m5.x2) / 2, y: m5.y }, { x: (m5.x1 + m5.x2) / 2, y: layout.slots[0]!.y });
    const edit = edited(onEditSequence);
    expect(edit.id).toBe('seq');
    expect('id' in edit.data.steps[0]! && edit.data.steps[0].id).toBe('m5');
  });

  it('reports a head dragged past its neighbor', async () => {
    const onEditSequence = vi.fn();
    const canvas = await mount({ onEditSequence });
    const head = layout.heads.find((h) => h.id === 'c')!;
    const at = { x: head.box.x + head.box.width / 2, y: head.box.y + 6 };
    await drag(canvas, at, { x: layout.columns[0]!.x + 10, y: at.y });
    expect(edited(onEditSequence).data.participants.map((p) => p.id)).toEqual(['a', 'c', 'b']);
  });

  it('reports a message end dragged onto another lifeline', async () => {
    const onEditSequence = vi.fn();
    const canvas = await mount({ onEditSequence });
    const m2 = layout.messages.find((m) => m.id === 'm2')!;
    await drag(canvas, { x: m2.x2, y: m2.y }, { x: layout.columns[2]!.x, y: m2.y });
    const m = findStep(edited(onEditSequence).data.steps, 'm2');
    expect(m?.kind === 'message' && m.to).toBe('c');
  });
});
