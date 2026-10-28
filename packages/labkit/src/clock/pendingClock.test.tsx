import { act } from '@testing-library/react';
import type { ClockRegistry } from '@weasel-js/clock';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useContext } from 'react';
import { describe, expect, it } from 'vitest';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { type LabContextValue, useLabContext } from '../lab/LabContext';
import { ClockRegistryContext } from './contexts';
import { useTrialClock } from './hooks';
import type { TrialClock } from './trialClock';

let lab: LabContextValue | null = null;
let registry: ClockRegistry | null = null;
const setters = new Map<string, (path: 'on', value: unknown) => void>();
const seen = new Map<string, (TrialClock | null)[]>();

function Seen({ id }: { id: string }) {
  lab = useLabContext();
  registry = useContext(ClockRegistryContext);
  const clock = useTrialClock();
  seen.set(id, [...(seen.get(id) ?? []), clock]);
  return null;
}

const switched = defineInstrument({
  name: 'Switched',
  config: f.schema({ on: f.boolean(true) }),
  initialState: () => ({}),
  clock: (c) => (c.on ? { duration: 60_000 } : null),
  render: (ctx) => {
    setters.set(ctx.trial.id, ctx.setConfig as (path: 'on', value: unknown) => void);
    return <Seen id={ctx.trial.id} />;
  },
});

describe('a trial whose clock is on its way', () => {
  it("never resolves the focused trial's clock in its place", async () => {
    await renderSettled(<Lab title="T" instruments={[switched]} defaultInstrument="Switched" />, {
      wrapper: withIcons,
    });
    const first = lab?.trials[0]?.id as string;
    await act(async () => lab?.addTrial('Switched'));
    const second = lab?.trials[1]?.id as string;
    expect(lab?.focusedTrialId).toBe(second);
    const playing = registry?.get(second)?.clock as TrialClock;
    act(() => {
      playing.rate = 1;
    });
    await act(async () => setters.get(first)?.('on', false));
    seen.set(first, []);
    await act(async () => setters.get(first)?.('on', true));
    const resolved = seen.get(first) ?? [];
    expect(resolved.at(-1)).toBe(registry?.get(first)?.clock);
    expect(resolved).not.toContain(playing);
  });
});
