/**
 * Authoring a sequence through a real canvas and dispatcher: the sequence
 * tools' bindings win their gestures, on the sequence's own regions too, and a
 * picked part is deleted with the Delete key. Each reports one edit.
 */
import { act, cleanup } from '@testing-library/react';
import type { ToolsApi } from '@weasel-js/core';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramView, type DiagramViewProps } from './DiagramView';
import type { SequenceEdit } from './sequence/commit';
import { findStep } from './sequence/edit';
import { SEQ_FIXTURE as data } from './sequence/fixture';
import { sequenceLayout } from './sequence/layout';
import { sequenceSpecs } from './sequence/specs';
import { sequenceTools, type SequenceToolId } from './sequence/tools';

afterEach(() => { cleanup(); });

const layout = sequenceLayout(data);
const SPECS = sequenceSpecs(data, { id: 'seq' });
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const col = (id: string) => layout.columns.find((c) => c.id === id)!.x;

function mount(tool: SequenceToolId | null, extra: Partial<DiagramViewProps> = {}) {
  const edits: SequenceEdit[] = [];
  const onEditSequence = (e: SequenceEdit) => edits.push(e);
  let api: ToolsApi | null = null;
  const tools = sequenceTools({ commit: onEditSequence, fragment: () => 'opt' });
  const { container } = render(
    <DiagramView
      specs={SPECS} width={layout.width} height={layout.height} view={VIEW} onViewChange={() => {}}
      onEditSequence={onEditSequence} tools={tools} onToolsCreated={(t) => { api = t; }} {...extra}
    />,
  );
  if (tool !== null) act(() => api!.setActive(tool));
  return { canvas: container.querySelector('canvas')!, edits };
}

const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number, shiftKey = false) =>
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1, shiftKey }));

const drag = (canvas: HTMLCanvasElement, from: { x: number; y: number }, to: { x: number; y: number }) => act(() => {
  pointer(canvas, 'pointerdown', from.x, from.y);
  pointer(canvas, 'pointermove', (from.x + to.x) / 2, (from.y + to.y) / 2);
  pointer(canvas, 'pointermove', to.x, to.y);
  pointer(canvas, 'pointerup', to.x, to.y);
});

const click = (canvas: HTMLCanvasElement, x: number, y: number, shiftKey = false) => act(() => {
  pointer(canvas, 'pointerdown', x, y, shiftKey);
  pointer(canvas, 'pointerup', x, y, shiftKey);
});

const ids = (edit: SequenceEdit) => edit.data.steps.map((s) => ('id' in s ? s.id : s.kind));

describe('sequence tools on a DiagramView', () => {
  it('draws a message from one lifeline to another at the row of the press', () => {
    const { canvas, edits } = mount('diagram.sequence.message');
    const last = layout.slots.at(-1)!;
    drag(canvas, { x: col('c'), y: last.y }, { x: col('a'), y: last.y + 30 });
    expect(edits).toHaveLength(1);
    const m = findStep(edits[0]!.data.steps, 'm6');
    expect(m).toMatchObject({ kind: 'message', from: 'c', to: 'a', line: 'solid', head: 'arrow' });
    expect(ids(edits[0]!).at(-1)).toBe('m6');
  });

  it('draws a message from a press on an existing message rather than moving it', () => {
    const { canvas, edits } = mount('diagram.sequence.message');
    const m1 = layout.messages.find((m) => m.id === 'm1')!;
    const x = (m1.x1 + m1.x2) / 2;
    drag(canvas, { x, y: m1.y }, { x: col('c'), y: m1.y });
    expect(edits).toHaveLength(1);
    expect(edits[0]!.label).toBe('Add message');
  });

  it('adds a participant where a click falls between lifelines', () => {
    const { canvas, edits } = mount('diagram.sequence.participant');
    click(canvas, (col('b') + col('c')) / 2, layout.height / 2);
    expect(edits.map((e) => e.data.participants.map((p) => p.id))).toEqual([['a', 'b', 'P1', 'c']]);
  });

  it('wraps the rows a Fragment drag crosses', () => {
    const { canvas, edits } = mount('diagram.sequence.fragment');
    const top = layout.slots.filter((s) => s.place.parent === null);
    drag(canvas, { x: col('b'), y: top[3]!.y }, { x: col('b'), y: top[5]!.y });
    expect(ids(edits[0]!)).toEqual(['m1', 'f1', 'n1', 'f2']);
    expect(findStep(edits[0]!.data.steps, 'f2')).toMatchObject({ type: 'opt' });
  });

  it('picks a message with a click and deletes it with the Delete key', async () => {
    const { canvas, edits } = mount(null);
    const m5 = layout.messages.find((m) => m.id === 'm5')!;
    click(canvas, (m5.x1 + m5.x2) / 2, m5.y);
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true, cancelable: true }));
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', code: 'Delete', bubbles: true }));
    });
    expect(edits).toHaveLength(1);
    expect(edits[0]!.label).toBe('Delete');
    expect(findStep(edits[0]!.data.steps, 'm5')).toBeNull();
  });

  it('reports a click on empty canvas with no start as nothing', () => {
    const onSelect = vi.fn();
    const { canvas, edits } = mount('diagram.sequence.participant', { onSelect, width: layout.width + 400 });
    click(canvas, layout.width + 200, 20);
    expect(edits).toHaveLength(0);
  });
});
