import type { Action, InvocationCtx } from '@weasel-js/core';
import { describe, expect, it, vi } from 'vitest';
import { createEditorReorderContributions, type ReorderSource } from './editorReorder';
import { mainChain } from './mainChain';
import type { EffectDoc, EffectStage } from './types';

const img = (id: string): EffectStage => ({ id, title: id, inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] });
const DOC: EffectDoc = {
  pipeline: {
    stages: [{ id: 'src', title: 'src', kind: 'source', outputs: [{ id: 'out', type: 'image' }] }, img('a'), img('b')],
    wires: [
      { id: 'w1', from: { stage: 'src', port: 'out' }, to: { stage: 'a', port: 'image' } },
      { id: 'w2', from: { stage: 'a', port: 'out' }, to: { stage: 'b', port: 'image' } },
    ],
  },
  places: {},
};
const BOXES: Record<string, { x: number; y: number; width: number; height: number }> = {
  src: { x: 0, y: 0, width: 100, height: 50 },
  a: { x: 200, y: 0, width: 100, height: 50 },
  b: { x: 400, y: 0, width: 100, height: 50 },
};

function drag(action: Action, from: { x: number; y: number }, to: { x: number; y: number }): void {
  const ctx = (p: { x: number; y: number }) => ({
    world: p, modifiers: { alt: false, shift: false, meta: false, ctrl: false }, deps: {},
    drag: { start: from, current: p, delta: { x: p.x - from.x, y: p.y - from.y } },
  }) as unknown as InvocationCtx;
  if (action.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const handle = action.invoker.start(ctx(from));
  handle.onMove?.(ctx(to));
  handle.onEnd?.(ctx(to), 'commit');
}

describe('createEditorReorderContributions', () => {
  it('reads a stage drop among the drawn items when the order names one with no box', () => {
    const onChange = vi.fn();
    const source: ReorderSource = {
      doc: DOC,
      order: { axis: 'x', items: [{ id: 'src' }, { id: 'ghost' }, { id: 'a' }, { id: 'b' }] },
      laneOrder: undefined,
      boxOf: (id) => BOXES[id],
      onChange,
    };
    const [stages] = createEditorReorderContributions(() => source);
    drag(stages!.actions![0]!, { x: 450, y: 25 }, { x: 160, y: 25 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(mainChain(onChange.mock.calls[0]![0].pipeline)).toEqual(['src', 'b', 'a']);
  });
});
