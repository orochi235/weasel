import { createMemoryAdapter, Persistence, TrialIdContext } from '@weasel-js/labkit';
import { KitSettingsProvider } from '@weasel-js/react';
import { act, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useVarsEdits, type VarsEdits } from './useVarsEdits';

/** Renders `count` panels' edits on one trial and one store, as tabs showing the same trial do. */
async function mount(count: number, settings: { history?: { coalesceMs: number } } = {}) {
  const edits: VarsEdits[] = [];
  function Probe({ at }: { at: number }) {
    edits[at] = useVarsEdits(null);
    return null;
  }
  const wrap = (children: ReactNode) => (
    <KitSettingsProvider value={settings}>
      <Persistence storageKey="vars-test" storage={createMemoryAdapter()}>
        <TrialIdContext.Provider value="t1">{children}</TrialIdContext.Provider>
      </Persistence>
    </KitSettingsProvider>
  );
  render(wrap(Array.from({ length: count }, (_, at) => <Probe key={at} at={at} />)));
  await waitFor(() => expect(edits.length).toBe(count));
  return edits;
}

describe('useVarsEdits', () => {
  it('makes commits in one tick one step with coalescing of separate edits turned off', async () => {
    const edits = await mount(1, { history: { coalesceMs: 0 } });
    act(() => {
      edits[0]!.write('--wzl-a', 'red');
      edits[0]!.write('--wzl-b', 'blue');
    });
    expect(edits[0]!.overrides).toEqual({ '--wzl-a': 'red', '--wzl-b': 'blue' });
    act(() => edits[0]!.history.step('undo'));
    expect(edits[0]!.overrides).toEqual({});
    expect(edits[0]!.history.canUndo).toBe(false);
  });

  it('keeps separate edits apart with coalescing turned off', async () => {
    const edits = await mount(1, { history: { coalesceMs: 0 } });
    act(() => edits[0]!.write('--wzl-a', 'red'));
    await act(async () => {});
    act(() => edits[0]!.write('--wzl-a', 'blue'));
    act(() => edits[0]!.history.step('undo'));
    expect(edits[0]!.overrides).toEqual({ '--wzl-a': 'red' });
  });

});
