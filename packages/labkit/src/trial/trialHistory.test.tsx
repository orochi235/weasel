import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Op } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useEffect, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import type { RenderContext } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { type TrialHistorySource, useTrialHistory } from './trialHistory';

function fakeHistory() {
  const listeners = new Set<() => void>();
  const entries: Op[] = [];
  const source = {
    able: false,
    canUndo: () => source.able,
    canRedo: () => false,
    undo: vi.fn(() => entries.pop()?.invert().apply(null)),
    redo: vi.fn(),
    record: vi.fn((op: Op) => entries.push(op)),
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    set(able: boolean) {
      source.able = able;
      for (const l of listeners) l();
    },
  };
  return source;
}

let history: ReturnType<typeof fakeHistory>;
let unmount: () => void;

function Body({ ctx }: { ctx: RenderContext<{ n: number }, Record<string, never>> }) {
  const [mounted, setMounted] = useState(true);
  unmount = () => setMounted(false);
  useTrialHistory(mounted ? (history as TrialHistorySource) : null);
  // A write while the history is mounted, which the trial must not snapshot.
  const wrote = useRef(false);
  useEffect(() => {
    if (wrote.current) return;
    wrote.current = true;
    ctx.setState((s) => ({ n: s.n + 1 }));
  });
  return null;
}

const instrument = defineInstrument<{ n: number }, Record<string, never>>({
  name: 'Own',
  defaultConfig: () => ({}),
  initialState: () => ({ n: 0 }),
  undo: {},
  render: (ctx) => <Body ctx={ctx} />,
});

function KnobOwner({ ctx }: { ctx: RenderContext<Record<string, never>, { size: number }> }) {
  useTrialHistory(history as TrialHistorySource);
  return (
    <button type="button" onClick={() => ctx.setConfig('size', ctx.config.size + 5)}>
      wider
    </button>
  );
}

const knob = defineInstrument({
  name: 'Knob',
  config: f.schema({ size: f.number(20).range(5, 80) }),
  initialState: () => ({}),
  undo: {},
  render: (ctx) => <KnobOwner ctx={ctx} />,
});

describe('useTrialHistory', () => {
  it("steps the instrument's own history from the trial's Undo, and takes no snapshots meanwhile", async () => {
    history = fakeHistory();
    await renderSettled(<Lab instruments={[instrument]} defaultInstrument="Own" />, {
      wrapper: withIcons,
    });
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();
    act(() => history.set(true));
    expect(undo).not.toBeDisabled();
    await userEvent.click(undo);
    expect(history.undo).toHaveBeenCalledOnce();

    act(() => unmount());
    expect(undo).toBeDisabled();
  });

  it('records a write to the path just undone as a new entry, however soon it comes', async () => {
    history = fakeHistory();
    await renderSettled(<Lab instruments={[knob]} defaultInstrument="Knob" />, {
      wrapper: withIcons,
    });
    fireEvent.click(screen.getByRole('button', { name: 'wider' }));
    expect(history.record).toHaveBeenCalledTimes(1);
    act(() => history.set(true));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(history.undo).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'wider' }));
    expect(history.record).toHaveBeenCalledTimes(2);
  });
});
