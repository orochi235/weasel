import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import type { JobEvent } from '../job/types';
import { Lab } from '../lab/Lab';

interface S {
  items: number[];
}
interface C {
  n: number;
}

function makeInstrument(name: string, n: number, delay: number) {
  return defineInstrument<S, C>({
    name,
    defaultConfig: () => ({ n }),
    initialState: () => ({ items: [] }),
    render: () => null,
    job: {
      auto: true,
      run: async function* ({ config, signal }): AsyncGenerator<JobEvent<never>> {
        yield { kind: 'total', total: config.n };
        for (let i = 0; i < config.n; i++) {
          await new Promise((r) => setTimeout(r, delay));
          if (signal.aborted) return;
          yield { kind: 'item', item: i as never };
        }
      },
      onItem: (item, state) => ({ items: [...state.items, item as number] }),
    },
  });
}

describe('a trial whose instrument declares a job', () => {
  it('shows progress in the trial chrome', async () => {
    const fast = makeInstrument('fast', 3, 1);
    render(<Lab instruments={[fast]} defaultInstrument="fast" storage={null} />);
    const bar = await waitFor(() => screen.getByRole('progressbar', { name: /job progress/i }));
    await waitFor(() => {
      // A job that reported a total drives a determinate bar, so the count and
      // the accessible value have to agree.
      expect(bar).toHaveAttribute('aria-valuemax', '3');
      expect(bar).toHaveAttribute('aria-valuenow', '3');
    });
    expect(document.querySelector('.lk-job__count')?.textContent).toMatch(/3\s*\/\s*3/);
  });

  it('offers a cancel control while running, and drops it once cancelled', async () => {
    const slow = makeInstrument('slow', 40, 20);
    render(<Lab instruments={[slow]} defaultInstrument="slow" storage={null} />);
    const cancel = await waitFor(() => screen.getByRole('button', { name: /cancel/i }));
    await userEvent.click(cancel);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });
  });

  it('renders no job chrome for an instrument that declares none', async () => {
    const plain = defineInstrument<S, C>({
      name: 'plain',
      defaultConfig: () => ({ n: 0 }),
      initialState: () => ({ items: [] }),
      render: () => null,
    });
    render(<Lab instruments={[plain]} defaultInstrument="plain" storage={null} />);
    await waitFor(() => {
      expect(document.querySelector('.lk-trial')).toBeInTheDocument();
    });
    expect(document.querySelector('.lk-trial__job')).not.toBeInTheDocument();
  });
});
