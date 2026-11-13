import { act, fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useMemo, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { type TrialHistorySource, useTrialHistory } from '../trial/trialHistory';
import { Lab } from './Lab';
import { LabContext, type LabContextValue } from './LabContext';

/** A counter whose every step is undoable, handed to the lab around it. */
function Counter() {
  const [stack, setStack] = useState({ done: [0], undone: [] as number[] });
  const value = stack.done.at(-1) ?? 0;
  const listeners = useMemo(() => new Set<() => void>(), []);
  const source = useMemo<TrialHistorySource>(
    () => ({
      canUndo: () => stack.done.length > 1,
      canRedo: () => stack.undone.length > 0,
      undo: () =>
        setStack((s) => ({ done: s.done.slice(0, -1), undone: [s.done.at(-1) ?? 0, ...s.undone] })),
      redo: () =>
        setStack((s) => ({ done: [...s.done, s.undone[0] ?? 0], undone: s.undone.slice(1) })),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      record: () => {},
    }),
    [stack, listeners],
  );
  useTrialHistory(source);
  return (
    <button
      type="button"
      onClick={() => setStack((s) => ({ done: [...s.done, value + 1], undone: [] }))}
    >
      Count {value}
    </button>
  );
}

let lab: LabContextValue | null = null;
function CaptureLab() {
  return (
    <LabContext.Consumer>
      {(value) => {
        lab = value;
        return null;
      }}
    </LabContext.Consumer>
  );
}

describe('a lab with no instruments', () => {
  it('renders its children as the body, with no trials and nothing to add one', async () => {
    const { container } = await renderSettled(
      <Lab title="Bare">
        <p data-testid="body">the page</p>
        <CaptureLab />
      </Lab>,
      { wrapper: withIcons },
    );
    expect(container.querySelector('.lk-lab__page')).toContainElement(screen.getByTestId('body'));
    expect(container.querySelector('.lk-trial')).toBeNull();
    expect(screen.queryByRole('button', { name: /Add trial/ })).toBeNull();
    expect(lab?.trials).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('gives a history its body hands over Undo and Redo, and Mod+Z', async () => {
    await renderSettled(
      <Lab title="Counting">
        <Counter />
      </Lab>,
      { wrapper: withIcons },
    );
    const undo = () => screen.getByRole('button', { name: 'Undo' });
    const redo = () => screen.getByRole('button', { name: 'Redo' });
    expect(undo()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Count 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Count 1' }));
    expect(undo()).toBeEnabled();
    await act(async () => fireEvent.click(undo()));
    expect(screen.getByRole('button', { name: 'Count 1' })).toBeTruthy();
    expect(redo()).toBeEnabled();
    await act(async () => fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }));
    expect(screen.getByRole('button', { name: 'Count 0' })).toBeTruthy();
    await act(async () =>
      fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: true }),
    );
    expect(screen.getByRole('button', { name: 'Count 1' })).toBeTruthy();
  });
});
