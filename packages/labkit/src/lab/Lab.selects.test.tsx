import { fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';
import { LabContext, type LabContextValue } from './LabContext';

// `Workspace` is drawn by the lab's own render and is not memoized, so it
// renders exactly when the lab does.
const workspace = vi.hoisted(() => ({ renders: 0 }));
vi.mock('./Workspace', async (original) => {
  const actual = await original<typeof import('./Workspace')>();
  return {
    ...actual,
    Workspace: (props: Parameters<typeof actual.Workspace>[0]) => {
      workspace.renders++;
      return <actual.Workspace {...props} />;
    },
  };
});

const counter: Instrument<{ n: number }> = {
  name: 'Counter',
  defaultConfig: () => ({}),
  initialState: () => ({ n: 0 }),
  render: (ctx) => (
    <button type="button" onClick={() => ctx.setState((s) => ({ n: s.n + 1 }))}>
      {`bump ${ctx.state.n}`}
    </button>
  ),
};

describe('a change to one trial’s record', () => {
  it('does not render the lab, and still reaches a reader of the lab context', async () => {
    let lab: LabContextValue | null = null;
    await renderSettled(
      <Lab instruments={[counter]} defaultInstrument="Counter">
        <LabContext.Consumer>
          {(value) => {
            lab = value;
            return null;
          }}
        </LabContext.Consumer>
      </Lab>,
    );
    // Settle focus on the trial, so the click below moves none.
    fireEvent.pointerDown(screen.getByRole('button', { name: 'bump 0' }));
    const before = workspace.renders;
    expect(before).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'bump 0' }));

    expect(screen.getByRole('button', { name: 'bump 1' })).toBeInTheDocument();
    expect(workspace.renders).toBe(before);
    expect((lab as LabContextValue | null)?.trials[0]?.state).toEqual({ n: 1 });
  });
});
