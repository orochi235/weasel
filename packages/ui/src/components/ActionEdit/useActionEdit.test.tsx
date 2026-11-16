import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { ActionsProvider, useActionsRegistry } from '@weasel-js/routing/react';
import { createDispatcher, dynamicActionId, type Action, type ActionsRegistry } from '@weasel-js/routing';
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
  const edit = useActionEdit(dynamicActionId('width'), (width: number) => ({ width }), 5);
  return (
    <InlineRange
      aria-label="Width" min={0} max={20} value={edit.shown}
      onValueInput={edit.onInput}
      onValueChange={edit.onChange}
      onValueCancel={edit.onCancel}
    />
  );
}

const FIVE = [{ value: 5 }];

function Thumbs() {
  const edit = useActionEdit(dynamicActionId('width'), (t: readonly { value: number }[]) => ({ width: t[0].value }), FIVE);
  return (
    <Slider
      aria-label="Width" min={0} max={10} step={1} thumbs={edit.shown}
      onInput={edit.onInput} onChange={edit.onChange} onCancel={edit.onCancel}
    />
  );
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
    expect(range).toHaveValue('9');
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
    expect(range).toHaveValue('5');
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
