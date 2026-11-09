/**
 * Reset starts a trial's undo afresh, on a history its instrument handed over
 * as much as on the trial's own snapshots.
 */
import { fireEvent, screen } from '@testing-library/react';
import { createHistory } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { type TrialHistorySource, useTrialHistory } from './trialHistory';

function owning(clears: boolean) {
  function Owner() {
    const [source] = useState((): TrialHistorySource => {
      const h = createHistory(null);
      return {
        canUndo: () => h.canUndo(),
        canRedo: () => h.canRedo(),
        undo: () => h.undo(),
        redo: () => h.redo(),
        dropRedo: () => h.dropRedo(),
        ...(clears ? { clear: () => h.clear() } : {}),
        subscribe: (listener) => h.subscribe(listener),
        record: (op, label) => h.recordEntry([op], label),
      };
    });
    useTrialHistory(source);
    return null;
  }
  return defineInstrument({
    name: 'Owning',
    config: f.schema({ grid: f.boolean(true).label('Show grid') }),
    initialState: () => ({}),
    undo: {},
    render: () => <Owner />,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

const grid = () => screen.getByRole('checkbox', { name: 'Show grid' });
const undo = () => screen.getByRole('button', { name: 'Undo' });

/** Two settings changes, far enough apart to be two undo steps, then Reset. */
async function flipTwiceAndReset(clears: boolean): Promise<void> {
  vi.useFakeTimers({ toFake: ['Date'] });
  await renderSettled(<Lab instruments={[owning(clears)]} defaultInstrument="Owning" />, {
    wrapper: withIcons,
  });
  fireEvent.click(grid());
  vi.advanceTimersByTime(600);
  fireEvent.click(grid());
  expect(grid()).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Reset trial' }));
}

describe('Reset on a trial whose instrument keeps its own history', () => {
  it('clears a history that can be cleared, leaving nothing to undo', async () => {
    await flipTwiceAndReset(true);
    expect(undo()).toBeDisabled();
  });

  it('keeps the settings entries on one that cannot from writing the old settings back', async () => {
    await flipTwiceAndReset(false);
    fireEvent.click(undo());
    expect(grid()).toBeChecked();
    fireEvent.click(undo());
    expect(grid()).toBeChecked();
  });
});
