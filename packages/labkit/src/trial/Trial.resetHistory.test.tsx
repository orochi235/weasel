/**
 * Reset starts a trial's undo afresh, on a history its instrument handed over
 * as much as on the trial's own snapshots and its marks.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { createHistory } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useAnnotations } from '../annotations/AnnotationsContext';
import type { AnnotationStorage, AnnotationsApi } from '../annotations/types';
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
  await renderSettled(<Lab instruments={[owning(clears)]} />, {
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

describe('Reset on a trial with marks', () => {
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as HTMLCanvasElement['getContext'];
  });

  let api: AnnotationsApi | null = null;
  function Pane() {
    api = useAnnotations();
    return null;
  }
  const marking = (storage?: AnnotationStorage) =>
    defineInstrument({
      name: 'Marking',
      config: f.schema({}),
      initialState: () => ({}),
      render: () => <Pane />,
      annotations: {
        targets: () => [
          { id: 'pane', ref: { current: null }, content: { width: 200, height: 100 } },
        ],
        ...(storage ? { storage } : {}),
      },
    });

  it.each([
    ['in the trial record', undefined],
    ['in storage of its own', { load: () => Promise.resolve(null), save: () => {} }],
  ])('keeps the marks kept %s, with nothing left to undo', async (_where, storage) => {
    await renderSettled(<Lab instruments={[marking(storage)]} />, { wrapper: withIcons });
    act(() => {
      api?.add({ target: 'pane', kind: 'rect', frac: { x: 0.2, y: 0.3, width: 0.1, height: 0.1 } });
    });
    expect(undo()).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset trial' }));
    expect(api?.query()).toHaveLength(1);
    expect(undo()).toBeDisabled();
  });
});
