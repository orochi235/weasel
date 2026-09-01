import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { WeaselProvider } from './WeaselProvider';
import { useActionsRegistry } from './interactions/actions/registry';
import { useSelectionContext } from './features/selection/SelectionContext';

/** Reports the registry identities visible at this point in the tree. */
function Probe({ into }: { into: { actions: unknown[]; selection: unknown[] } }) {
  into.actions.push(useActionsRegistry());
  into.selection.push(useSelectionContext());
  return null;
}

describe('WeaselProvider', () => {
  it('defers to a provider already in scope', () => {
    const seen = { actions: [] as unknown[], selection: [] as unknown[] };
    render(
      <WeaselProvider>
        <Probe into={seen} />
        <WeaselProvider>
          <Probe into={seen} />
        </WeaselProvider>
      </WeaselProvider>,
    );
    expect(seen.actions[0]).not.toBeNull();
    expect(seen.actions[1]).toBe(seen.actions[0]);
    expect(seen.selection[1]).toBe(seen.selection[0]);
  });

  // Two canvases cannot share one actions registry — the second to mount takes
  // the dispatcher slot and the first stops responding.
  it('mounts its own scope under `isolate`, ignoring the one in scope', () => {
    const seen = { actions: [] as unknown[], selection: [] as unknown[] };
    render(
      <WeaselProvider>
        <Probe into={seen} />
        <WeaselProvider isolate>
          <Probe into={seen} />
        </WeaselProvider>
      </WeaselProvider>,
    );
    expect(seen.actions[0]).not.toBeNull();
    expect(seen.actions[1]).not.toBeNull();
    expect(seen.actions[1]).not.toBe(seen.actions[0]);
    expect(seen.selection[1]).not.toBe(seen.selection[0]);
  });

  it('gives two isolated siblings a scope each', () => {
    const seen = { actions: [] as unknown[], selection: [] as unknown[] };
    render(
      <WeaselProvider>
        <WeaselProvider isolate><Probe into={seen} /></WeaselProvider>
        <WeaselProvider isolate><Probe into={seen} /></WeaselProvider>
      </WeaselProvider>,
    );
    expect(seen.actions[0]).not.toBe(seen.actions[1]);
  });
});
