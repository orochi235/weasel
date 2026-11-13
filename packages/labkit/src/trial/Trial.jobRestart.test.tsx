/**
 * A trial that starts afresh (Reset, or a snapshot loaded over it) drops the
 * job run that was folding into the state it replaced.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import type { JobEvent } from '../job/types';
import { Lab } from '../lab/Lab';

interface S {
  items: number[];
}

/** Each item waits on `release`, so the test decides when the run moves. */
function stepped(auto: boolean) {
  const waiting: (() => void)[] = [];
  const instrument = defineInstrument<S, { n: number }, number>({
    name: 'Stepped',
    defaultConfig: () => ({ n: 4 }),
    initialState: () => ({ items: [] }),
    render: (ctx) => (
      <>
        <output data-testid="items">{ctx.state.items.join(',')}</output>
        <button type="button" onClick={() => ctx.job?.start()}>
          Run
        </button>
      </>
    ),
    job: {
      auto,
      run: async function* ({ config }): AsyncGenerator<JobEvent<number>> {
        for (let i = 0; i < config.n; i++) {
          await new Promise<void>((r) => waiting.push(r));
          yield { kind: 'item', item: i };
        }
      },
      onItem: (item, state) => ({ items: [...state.items, item] }),
    },
  });
  const release = async (): Promise<void> => {
    await act(async () => {
      for (const r of waiting.splice(0)) r();
      await new Promise((r) => setTimeout(r, 0));
    });
  };
  return { instrument, release };
}

const items = () => screen.getByTestId('items').textContent;

describe('a job running when its trial starts afresh', () => {
  it('runs again from the start on Reset when the job is auto', async () => {
    const { instrument, release } = stepped(true);
    renderWithIcons(<Lab instruments={[instrument]} />);
    await waitFor(() => expect(screen.getByTestId('items')).toBeInTheDocument());
    await release();
    await release();
    expect(items()).toBe('0,1');
    fireEvent.click(screen.getByRole('button', { name: 'Reset trial' }));
    expect(items()).toBe('');
    for (let i = 0; i < 6; i++) await release();
    expect(items()).toBe('0,1,2,3');
  });

  it('stops on Reset when the job is started by hand', async () => {
    const { instrument, release } = stepped(false);
    renderWithIcons(<Lab instruments={[instrument]} />);
    await waitFor(() => expect(screen.getByTestId('items')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await release();
    await release();
    expect(items()).toBe('0,1');
    fireEvent.click(screen.getByRole('button', { name: 'Reset trial' }));
    for (let i = 0; i < 4; i++) await release();
    expect(items()).toBe('');
    expect(screen.queryByRole('progressbar', { name: /job progress/i })).toBeNull();
  });
});
