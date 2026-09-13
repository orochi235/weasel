/**
 * An instrument hosted by a real <Lab> must be able to reach trial-scoped
 * hooks. `<TrialIdProvider>` had exactly one production mount —
 * `SingletonExperiment` — so `useTrialState()` threw everywhere else, which
 * made the documented hook pattern unreachable from an instrument's `render`.
 */
import { act, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { useTrialState } from '../state/useTrialState';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

function Probe() {
  const { state } = useTrialState<{ hits: number }, Record<string, never>>();
  return <div data-testid="probe">hits:{state.hits}</div>;
}

const reader = defineInstrument<{ hits: number }, Record<string, never>>({
  name: 'Reader',
  defaultConfig: () => ({}),
  initialState: () => ({ hits: 7 }),
  render: () => <Probe />,
});

describe('<Trial> trial-scoped hooks', () => {
  it('lets an instrument read its own trial state through useTrialState', () => {
    render(<Lab instruments={[reader]} defaultInstrument="Reader" />);
    expect(screen.getByTestId('probe')).toHaveTextContent('hits:7');
  });
});

describe('<Trial> root element', () => {
  it('carries its trial id, so a lab can find a trial from outside', () => {
    let labRef: LabContextValue | null = null;
    const { container } = render(
      <Lab instruments={[reader]} defaultInstrument="Reader">
        <LabContext.Consumer>
          {(value) => {
            if (value) labRef = value;
            return null;
          }}
        </LabContext.Consumer>
      </Lab>,
    );
    act(() => (labRef as LabContextValue | null)?.addTrial('Reader'));
    const ids = (labRef as LabContextValue | null)?.trials.map((t) => t.id) ?? [];
    expect(ids).toHaveLength(2);
    const roots = container.querySelectorAll<HTMLElement>('.lk-trial[data-trial-id]');
    expect([...roots].map((el) => el.dataset.trialId)).toEqual(ids);
  });
});
