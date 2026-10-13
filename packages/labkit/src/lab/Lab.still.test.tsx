import { screen, waitFor } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { createMemoryAdapter } from '@weasel-js/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useClockFrame } from '../clock/hooks';
import type { ClockCapability, TrialClock } from '../clock/trialClock';
import type { Instrument } from '../instrument/types';
import { labPrefix } from '../state/labRecords';
import { Lab } from './Lab';
import type { LabProps } from './labProps';

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

  describe('of a clock that is not seekable and names a step', () => {
    let frames: number[] = [];
    function Counter() {
      useClockFrame((elapsed) => frames.push(elapsed));
      return null;
    }
    const running = (spec: ClockCapability | 'lab'): Instrument => ({
      ...timed(spec),
      render: (ctx) => {
        clock = ctx.trial.clock ?? null;
        return <Counter />;
      },
    });
    const mountRunning = (spec: ClockCapability | 'lab', props: Partial<LabProps>) => {
      frames = [];
      const lab = { instruments: [running(spec)], defaultInstrument: 'Timed', ...props };
      return renderSettled(<Lab {...(lab as LabProps)} />);
    };
    // A real frame can repeat the time the run starts or stops at.
    const distinct = () => frames.filter((e, i) => e !== frames[i - 1]);
    const upTo950 = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

    it('runs it forward to the time, a step a frame, and holds it there', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await mountRunning({ rate: 1, seekable: false, step: 100 }, { still: 950 });
      expect(distinct()).toEqual(upTo950);
      expect(c().elapsed).toBe(950);
      expect(c().rate).toBe(0);
      expect(warn).not.toHaveBeenCalled();
    });

    it("runs the lab's clock forward once its trial is listening", async () => {
      const lab = { rate: 1, seekable: false, step: 100 };
      await mountRunning('lab', { still: 950, clock: lab });
      expect(distinct()).toEqual(upTo950);
    });

    it('stops where a finite run ends', async () => {
      await mountRunning({ duration: 300, seekable: false, step: 100 }, { still: 950 });
      expect(c().elapsed).toBe(300);
      expect(c().rate).toBe(0);
    });

    it('does not charge the frames it never showed to the next real one', async () => {
      await mountRunning({ rate: 1, seekable: false, step: 100 }, { still: 950 });
      c().rate = 1;
      c().sync(5_000_000);
      expect(c().elapsed).toBe(950);
    });
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
