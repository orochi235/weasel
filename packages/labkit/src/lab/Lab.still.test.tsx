import { screen, waitFor } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { createMemoryAdapter } from '@weasel-js/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClockCapability, TrialClock } from '../clock/trialClock';
import type { Instrument } from '../instrument/types';
import { labPrefix } from '../state/labRecords';
import { Lab, type LabProps } from './Lab';

let clock: TrialClock | null = null;

function timed(spec: ClockCapability | 'lab'): Instrument {
  return {
    name: 'Timed',
    defaultConfig: () => ({}),
    initialState: () => ({}),
    clock: spec,
    render: (ctx) => {
      clock = ctx.trial.clock ?? null;
      return <div data-testid="content" />;
    },
  };
}

function mountLab(spec: ClockCapability | 'lab', props: Partial<LabProps> = {}) {
  return renderSettled(
    <Lab {...({ instruments: [timed(spec)], defaultInstrument: 'Timed', ...props } as LabProps)} />,
  );
}

const c = () => clock as TrialClock;
const root = (container: HTMLElement) => container.querySelector('.lk-lab') as HTMLElement;

afterEach(() => {
  clock = null;
  history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('<Lab still>', () => {
  it('presents one trial with its clock paused where it opens', async () => {
    const { container } = await mountLab({ duration: 4000, rate: 1 }, { still: true });
    expect(root(container).classList.contains('lk-lab--present')).toBe(true);
    expect(root(container).classList.contains('lk-lab--still')).toBe(true);
    expect(container.querySelectorAll('.lk-trial[data-lk-presented]')).toHaveLength(1);
    expect(c().rate).toBe(0);
    expect(c().elapsed).toBe(0);
  });

  it('holds the clock at the time it names', async () => {
    await mountLab({ duration: 4000, rate: 1 }, { still: 1200 });
    expect(c().rate).toBe(0);
    expect(c().elapsed).toBe(1200);
  });

  it('holds the lab clock too', async () => {
    await mountLab('lab', { still: 500, clock: { duration: 2000, rate: 1 } });
    expect(c().rate).toBe(0);
    expect(c().elapsed).toBe(500);
  });

  it('reads `?still` and `?still=<ms>` from the URL', async () => {
    history.replaceState(null, '', '/?still=750');
    const { container } = await mountLab({ duration: 4000, rate: 1 });
    expect(root(container).classList.contains('lk-lab--still')).toBe(true);
    expect(c().elapsed).toBe(750);
  });

  it('leaves a clock that is not seekable where it opens, and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await mountLab({ rate: 1, seekable: false }, { still: 900 });
    expect(c().rate).toBe(0);
    expect(c().elapsed).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not seekable'));
  });

  it('shows no play controls', async () => {
    await mountLab({ duration: 4000 }, { still: true });
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
  });

  it('neither reads nor writes the stored presentation', async () => {
    const storage = createMemoryAdapter();
    const records = () => storage.list(labPrefix('still-lab:present'));
    const stored = { storageKey: 'still-lab', storage } as Partial<LabProps>;
    const first = await mountLab({ duration: 4000 }, { ...stored, present: true });
    c().seek(3000);
    await waitFor(async () => expect(JSON.stringify(await records())).toContain('"elapsed":3000'));
    first.unmount();
    const before = await records();

    await mountLab({ duration: 4000 }, { ...stored, still: true });
    expect(c().elapsed).toBe(0);
    expect(await records()).toEqual(before);
  });

  it('marks itself ready once it has painted', async () => {
    const { container } = await mountLab({ duration: 4000 }, { still: true });
    expect(root(container).classList.contains('lk-lab--still-ready')).toBe(false);
    await waitFor(() =>
      expect(root(container).classList.contains('lk-lab--still-ready')).toBe(true),
    );
  });
});
