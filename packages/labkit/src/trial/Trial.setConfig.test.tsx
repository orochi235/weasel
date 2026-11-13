import { fireEvent, screen, within } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { useTrialState } from '../state/useTrialState';

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
  renderSettled(<Lab instruments={[counting(snapshotOn)]} />, {
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

  it('puts the setting back on undo, not only the state derived from it', async () => {
    await mount();
    const grid = screen.getByLabelText('Show grid');
    expect(grid).toBeChecked();
    fireEvent.click(grid);
    expect(grid).not.toBeChecked();
    fireEvent.click(undo());
    expect(screen.getByLabelText('Show grid')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByLabelText('Show grid')).not.toBeChecked();
    expect(changes()).toBe('1');
  });

  it('records a settings change by default', async () => {
    await renderSettled(
      <Lab instruments={[{ ...counting([]), undo: undefined }]} opening={['Counting']} />,
      { wrapper: withIcons },
    );
    fireEvent.click(screen.getByLabelText('Show grid'));
    fireEvent.click(undo());
    expect(screen.getByLabelText('Show grid')).toBeChecked();
  });

  it('snapshots on the event that names the path, from either side', async () => {
    await mount(['config.change:showGrid']);
    click('wider');
    expect(undo()).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Show grid'));
    expect(undo()).not.toBeDisabled();
  });

  it('records one entry for a write that both its events snapshot on', async () => {
    await mount(['config.change', 'config.change:cellSize']);
    click('wider');
    fireEvent.click(undo());
    expect(changes()).toBe('0');
    expect(undo()).toBeDisabled();
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

  it('keeps a run in one entry while another lab on the page records an edit', async () => {
    await renderSettled(
      <>
        <div data-testid="lab-a">
          <Lab instruments={[counting(['config.change'])]} />
        </div>
        <div data-testid="lab-b">
          <Lab instruments={[counting(['config.change'])]} />
        </div>
      </>,
      { wrapper: withIcons },
    );
    const a = within(screen.getByTestId('lab-a'));
    const b = within(screen.getByTestId('lab-b'));
    fireEvent.click(a.getByRole('button', { name: 'wider' }));
    fireEvent.click(b.getByRole('button', { name: 'flip' }));
    fireEvent.click(a.getByRole('button', { name: 'wider' }));
    expect(a.getByLabelText('changes').textContent).toBe('2');
    fireEvent.click(a.getByRole('button', { name: 'Undo' }));
    expect(a.getByLabelText('changes').textContent).toBe('0');
  });

  it('starts a new entry when the path changes', async () => {
    await mount();
    click('wider');
    click('flip');
    fireEvent.click(undo());
    expect(changes()).toBe('1');
  });
});

describe("a trial's other writes", () => {
  it("routes useTrialState's setConfig through the trial: onConfigChange and undo hear it", async () => {
    function Knob() {
      const { setConfig } = useTrialState<{ changes: number }, { cellSize: number }>();
      return (
        <button type="button" onClick={() => setConfig('cellSize', 40)}>
          knob
        </button>
      );
    }
    const base = counting(['config.change']);
    const withKnob = {
      ...base,
      render: (ctx: Parameters<typeof base.render>[0]) => (
        <>
          {base.render(ctx)}
          <Knob />
        </>
      ),
    };
    await renderSettled(<Lab instruments={[withKnob]} />, {
      wrapper: withIcons,
    });
    click('knob');
    expect(changes()).toBe('1');
    fireEvent.click(undo());
    expect(changes()).toBe('0');
  });

  it('starts a fresh undo history on Reset', async () => {
    await mount();
    click('wider');
    expect(undo()).not.toBeDisabled();
    click('Reset trial');
    expect(undo()).toBeDisabled();
  });
});

describe('a settings drag', () => {
  const slider = () => screen.getByRole('slider', { name: 'Cell size' });
  const drag = (value: number) => fireEvent.input(slider(), { target: { value: String(value) } });

  it('is one undo step however long it pauses, ending where it settles', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await mount();
    drag(30);
    vi.advanceTimersByTime(800);
    drag(40);
    fireEvent.change(slider(), { target: { value: '40' } });
    expect(slider()).toHaveValue('40');
    fireEvent.click(undo());
    expect(slider()).toHaveValue('20');
    expect(undo()).toBeDisabled();
  });

  it('starts a step of its own after the last one settled', async () => {
    await mount();
    drag(30);
    fireEvent.change(slider(), { target: { value: '30' } });
    drag(50);
    fireEvent.change(slider(), { target: { value: '50' } });
    fireEvent.click(undo());
    expect(slider()).toHaveValue('30');
  });
});
