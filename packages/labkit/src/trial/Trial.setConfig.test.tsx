import { fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

// The settings panel and the instrument's own `ctx.setConfig` are one write.

/** Counts config changes in its state, and undoes over them. */
const counting = (snapshotOn: string[]) =>
  defineInstrument({
    name: 'Counting',
    config: f.schema({
      showGrid: f.boolean(true),
      cellSize: f.number(20).range(5, 80).step(5),
    }),
    initialState: () => ({ changes: 0 }),
    undo: { snapshotOn },
    onConfigChange: (_config, _prev, state) => ({ changes: state.changes + 1 }),
    render: (ctx) => (
      <>
        <output aria-label="changes">{ctx.state.changes}</output>
        <button type="button" onClick={() => ctx.setConfig('cellSize', ctx.config.cellSize + 5)}>
          wider
        </button>
        <button type="button" onClick={() => ctx.setConfig('showGrid', !ctx.config.showGrid)}>
          flip
        </button>
      </>
    ),
  });

const mount = (snapshotOn: string[] = ['config.change']) =>
  renderSettled(<Lab instruments={[counting(snapshotOn)]} defaultInstrument="Counting" />, {
    wrapper: withIcons,
  });
const changes = () => screen.getByLabelText('changes').textContent;
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const undo = () => screen.getByRole('button', { name: 'Undo' });

afterEach(() => {
  vi.useRealTimers();
});

describe('a trial config write', () => {
  it("runs onConfigChange for the instrument's own write", async () => {
    await mount();
    click('wider');
    expect(changes()).toBe('1');
  });

  it('takes an undo snapshot for a change made in the settings panel', async () => {
    await mount();
    expect(undo()).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Show grid'));
    expect(changes()).toBe('1');
    expect(undo()).not.toBeDisabled();
    fireEvent.click(undo());
    expect(changes()).toBe('0');
  });

  it('snapshots on the event that names the path, from either side', async () => {
    await mount(['config.change:showGrid']);
    click('wider');
    expect(undo()).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Show grid'));
    expect(undo()).not.toBeDisabled();
  });

  it('keeps a run of writes to one path in one undo entry, and ends it after a pause', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await mount();
    click('wider');
    click('wider');
    click('wider');
    expect(changes()).toBe('3');
    fireEvent.click(undo());
    expect(changes()).toBe('0');
    expect(undo()).toBeDisabled();

    click('wider');
    vi.advanceTimersByTime(600);
    click('wider');
    fireEvent.click(undo());
    expect(changes()).toBe('1');
  });

  it('starts a new entry when the path changes', async () => {
    await mount();
    click('wider');
    click('flip');
    fireEvent.click(undo());
    expect(changes()).toBe('1');
  });
});
