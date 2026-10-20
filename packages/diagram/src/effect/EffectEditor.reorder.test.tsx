import { cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Action, InvocationCtx } from '@weasel-js/core';
import type { DiagramViewProps } from '../DiagramView';

const seen: DiagramViewProps[] = [];
vi.mock('../DiagramView', () => ({
  DiagramView: (props: DiagramViewProps) => {
    seen.push(props);
    return null;
  },
}));

import { REORDER_ACTION_ID } from '../slotReorder';
import { EffectEditor, type EffectEditorApi } from './EffectEditor';
import { REORDER_LANES_ACTION_ID } from './editorReorder';
import { mainChain } from './mainChain';
import type { EffectStageType } from './stageTypes';
import type { EffectDoc, EffectStage } from './types';

afterEach(() => {
  cleanup();
  seen.length = 0;
});

const img = (id: string, extra: Partial<EffectStage> = {}): EffectStage => ({
  id, title: id, inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }], ...extra,
});
const DOC: EffectDoc = {
  pipeline: {
    stages: [
      { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
      img('a'),
      img('b', { inputs: [{ id: 'image', type: 'image' }, { id: 'amount', type: 'number' }] }),
      { id: 'n', title: 'N', outputs: [{ id: 'v', type: 'number' }] },
    ],
    wires: [
      { id: 'w1', from: { stage: 'src', port: 'out' }, to: { stage: 'a', port: 'image' } },
      { id: 'w2', from: { stage: 'a', port: 'out' }, to: { stage: 'b', port: 'image' } },
      { id: 'w3', from: { stage: 'n', port: 'v' }, to: { stage: 'b', port: 'amount' } },
    ],
  },
  places: { src: { x: 0, y: 0 } },
};

type Box = { x: number; y: number; width: number; height: number };
const view = () => seen.at(-1)!;
const boxOf = (id: string) => view().specs.find((s) => s.id === id)!.pose as Box;
const center = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

function actionOf(id: string): Action {
  const action = (view().ambient ?? []).flatMap((c) => c.actions ?? []).find((a) => a.id === id);
  if (action === undefined) throw new Error(`no ${id} action`);
  return action;
}

/** A drag of `action` from `from` to `to`, released. */
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

describe('EffectEditor under rack and lanes', () => {
  it('lets no stage move freely, and keeps connect, reconnect, and delete', () => {
    render(<EffectEditor doc={DOC} onChange={() => {}} look="rack" width={600} height={400} />);
    expect(view().onMove).toBeUndefined();
    expect(view().onConnect).toBeDefined();
    expect(view().onReconnect).toBeDefined();
    expect(view().onDelete).toBeDefined();
  });

  it('reports a stage dragged along the rack line as one Reorder', () => {
    const onChange = vi.fn();
    render(<EffectEditor doc={DOC} onChange={onChange} look="rack" width={600} height={400} />);
    const b = boxOf('b');
    drag(actionOf(REORDER_ACTION_ID), center(boxOf('a')), { x: b.x + b.width + 30, y: b.y });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next, label] = onChange.mock.calls[0]!;
    expect(label).toBe('Reorder');
    expect(mainChain(next.pipeline)).toEqual(['src', 'b', 'a']);
  });

  it('reports nothing for a drop the wiring cannot take', () => {
    const onChange = vi.fn();
    render(<EffectEditor doc={DOC} onChange={onChange} look="rack" width={600} height={400} />);
    const src = boxOf('src');
    drag(actionOf(REORDER_ACTION_ID), center(boxOf('b')), { x: src.x - 30, y: src.y });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports a lane dragged by its header as one Reorder lanes', () => {
    const onChange = vi.fn();
    render(<EffectEditor doc={DOC} onChange={onChange} look="lanes" width={600} height={400} />);
    const image = boxOf('~lane:image');
    const number = boxOf('~lane:number');
    drag(actionOf(REORDER_LANES_ACTION_ID), { x: image.x + 4, y: center(image).y }, { x: image.x + 4, y: number.y + number.height + 10 });
    const [next, label] = onChange.mock.calls[0]!;
    expect(label).toBe('Reorder lanes');
    expect(next.laneOrder).toEqual(['number', 'image']);
  });

  it('adds a stage without placing it, where the look places every stage', () => {
    const onChange = vi.fn();
    const api = createRef<EffectEditorApi>();
    const blur: EffectStageType = { type: 'blur', title: 'Blur', inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] };
    render(<EffectEditor ref={api} doc={DOC} onChange={onChange} look="lanes" width={600} height={400} />);
    api.current!.addStage(blur, { x: 10, y: 10 });
    const next = onChange.mock.calls[0]![0] as EffectDoc;
    expect(next.places).toEqual(DOC.places);
    expect(next.pipeline.stages.at(-1)!.id).toBe('blur');
  });
});
