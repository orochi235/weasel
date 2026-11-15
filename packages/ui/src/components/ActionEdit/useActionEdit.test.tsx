import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { ActionsProvider, createDispatcher, dynamicActionId, useActionsRegistry, type Action, type ActionsRegistry } from '@weasel-js/core';
import { InlineRange } from '../InlineRange';
import { Slider } from '../Slider';
import { useActionEdit } from './useActionEdit';

interface Runs {
  start: unknown[];
  move: unknown[];
  end: string[];
}

function recording(runs: Runs): Action {
  return {
    id: 'width',
    label: 'Width',
    invoker: {
      timing: 'ongoing',
      start: (ctx) => {
        runs.start.push(ctx.params);
        return {
          onMove: (c) => { runs.move.push(c.params); },
          onEnd: (_c, reason) => { runs.end.push(reason); },
        };
      },
    },
  };
}

function Wire({ runs }: { runs: Runs }) {
  const reg = useActionsRegistry() as ActionsRegistry;
  useEffect(() => {
    const off = reg.register(recording(runs));
    reg.setDispatcher(createDispatcher({ getAction: (id) => reg.list().find((a) => a.id === id) }));
    return off;
  }, [reg, runs]);
  return null;
}

function Range() {
  const [v, setV] = useState(5);
  const edit = useActionEdit(dynamicActionId('width'), (width: number) => ({ width }));
  return (
    <InlineRange
      aria-label="Width" min={0} max={20} value={v}
      onValueInput={(n) => { setV(n); edit.onInput(n); }}
      onValueChange={edit.onChange}
      onValueCancel={edit.onCancel}
    />
  );
}

function Thumbs() {
  const edit = useActionEdit(dynamicActionId('width'), (t: { value: number }[]) => ({ width: t[0].value }));
  return <Slider aria-label="Width" min={0} max={10} step={1} thumbs={[{ value: 5 }]} {...edit} />;
}

const setup = (ui: React.ReactElement) => {
  const runs: Runs = { start: [], move: [], end: [] };
  render(<ActionsProvider><Wire runs={runs} />{ui}</ActionsProvider>);
  return runs;
};

describe('useActionEdit', () => {
  it('runs a drag as one ongoing action: begun on the first move, moved on the rest, ended at the release', () => {
    const runs = setup(<Range />);
    const range = screen.getByLabelText('Width');
    fireEvent.pointerDown(range);
    fireEvent.input(range, { target: { value: '7' } });
    fireEvent.input(range, { target: { value: '9' } });
    expect(runs.start).toEqual([{ width: 7 }]);
    expect(runs.move).toEqual([{ width: 9 }]);
    expect(runs.end).toEqual([]);
    act(() => { fireEvent.change(range, { target: { value: '9' } }); });
    expect(runs.end).toEqual(['commit']);
  });

  it('ends the run as canceled on Escape', () => {
    const runs = setup(<Range />);
    const range = screen.getByLabelText('Width');
    fireEvent.pointerDown(range);
    fireEvent.input(range, { target: { value: '7' } });
    fireEvent.keyDown(range, { key: 'Escape' });
    expect(runs.end).toEqual(['cancel']);
    expect(runs.start).toHaveLength(1);
  });

  it('makes each key step a run of its own', () => {
    const runs = setup(<Thumbs />);
    const thumb = screen.getByRole('slider');
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(runs.start).toEqual([{ width: 6 }, { width: 6 }]);
    expect(runs.end).toEqual(['commit', 'commit']);
  });
});
