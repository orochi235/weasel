import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useEffect, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import type { RenderContext } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { type TrialHistorySource, useTrialHistory } from './trialHistory';

function fakeHistory() {
  const listeners = new Set<() => void>();
  const source = {
    able: false,
    canUndo: () => source.able,
    canRedo: () => false,
    undo: vi.fn(),
    redo: vi.fn(),
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
});
