import { act, fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TrialContribution } from '../chrome/types';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';
import { LabContext, type LabContextValue } from './LabContext';

// A change to one trial's record is that trial's to render. The store holds
// every trial in one array, so anything reading the array re-renders them all.

let renders: Record<string, number> = {};
let chromeRenders: Record<string, number> = {};
let lab: LabContextValue | null = null;

const counter: Instrument<{ n: number }> = {
  name: 'Counter',
  defaultConfig: () => ({}),
  initialState: () => ({ n: 0 }),
  render: (ctx) => {
    renders[ctx.trial.id] = (renders[ctx.trial.id] ?? 0) + 1;
    return (
      <button type="button" onClick={() => ctx.setState((s) => ({ n: s.n + 1 }))}>
        {`bump ${ctx.trial.id}`}
      </button>
    );
  },
};

const CHROME: readonly TrialContribution[] = [
  {
    id: 'count',
    region: 'status',
    render: (ctx) => {
      chromeRenders[ctx.trialId] = (chromeRenders[ctx.trialId] ?? 0) + 1;
      return null;
    },
  },
];

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

beforeEach(() => {
  renders = {};
  chromeRenders = {};
  lab = null;
});

describe('a lab with two trials', () => {
  it('renders only the trial whose record changed, chrome and all', async () => {
    await renderSettled(
      <Lab instruments={[counter]} defaultInstrument="Counter" chrome={CHROME}>
        <CaptureLab />
      </Lab>,
      { wrapper: withIcons },
    );
    await act(async () => lab?.addTrial('Counter'));
    const [first, second] = (lab?.trials ?? []).map((t) => t.id) as [string, string];
    expect(second).toBeDefined();
    // Settle focus on the first, so the click below moves none.
    await act(async () => lab?.focusTrial(first));
    const before = { ...renders };
    const chromeBefore = { ...chromeRenders };

    fireEvent.click(screen.getByRole('button', { name: `bump ${first}` }));

    expect(renders[first]).toBeGreaterThan(before[first] ?? 0);
    expect(renders[second]).toBe(before[second]);
    expect(chromeRenders[second]).toBe(chromeBefore[second]);
  });

  it('still hands a reader of the lab context every trial as it changes', async () => {
    await renderSettled(
      <Lab instruments={[counter]} defaultInstrument="Counter">
        <CaptureLab />
      </Lab>,
      { wrapper: withIcons },
    );
    const [id] = (lab?.trials ?? []).map((t) => t.id) as [string];
    fireEvent.click(screen.getByRole('button', { name: `bump ${id}` }));
    expect(lab?.trials[0]?.state).toEqual({ n: 1 });
  });
});
