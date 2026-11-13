/**
 * A trial's undo survives a reload: its history is saved in the trial's
 * record, beside the state it undoes, and restored when the trial mounts.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { createMemoryAdapter } from '@weasel-js/storage';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { labPrefix, trialRecord } from '../state/labRecords';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

const counter = defineInstrument<{ n: number }, Record<string, never>>({
  name: 'Counter',
  defaultConfig: () => ({}),
  initialState: () => ({ n: 0 }),
  // A state storage cannot hold as it is, so the saved history has to go through these too.
  serialize: (s) => ({ count: s.n }),
  deserialize: (data) => ({ n: (data as { count: number }).count }),
  render: (ctx) => (
    <>
      <output aria-label="n">{ctx.state.n}</output>
      <button type="button" onClick={() => ctx.setState((s) => ({ n: s.n + 1 }))}>
        more
      </button>
    </>
  ),
});

const KEY = 'undo-persist-test';

function mount(backing: Map<string, unknown>) {
  return renderSettled(
    <Lab instruments={[counter]} storage={createMemoryAdapter(backing)} storageKey={KEY} />,
    { wrapper: withIcons },
  );
}

function stored(backing: Map<string, unknown>): Record<string, unknown> | undefined {
  const prefix = `${labPrefix(KEY)}trial:`;
  return [...backing].find(([key]) => key.startsWith(prefix))?.[1] as
    | Record<string, unknown>
    | undefined;
}

type Scope = Pick<typeof screen, 'getByLabelText' | 'getByRole'>;
const n = (at: Scope = screen) => at.getByLabelText('n').textContent;
const press = (name: 'Undo' | 'Redo' | 'more', at: Scope = screen) =>
  fireEvent.click(at.getByRole('button', { name }));
const undoButton = (at: Scope = screen) => at.getByRole('button', { name: 'Undo' });

describe("a trial's undo across a reload", () => {
  it('undoes and redoes the same values after the lab is opened again', async () => {
    const backing = new Map<string, unknown>();
    const first = await mount(backing);
    press('more');
    press('more');
    press('more');
    press('Undo');
    expect(n()).toBe('2');
    first.unmount();
    await waitFor(() => expect(stored(backing)?.undo).toBeDefined());

    await mount(backing);
    expect(n()).toBe('2');
    await waitFor(() => expect(undoButton()).toBeEnabled());
    press('Undo');
    expect(n()).toBe('1');
    press('Undo');
    expect(n()).toBe('0');
    press('Redo');
    press('Redo');
    press('Redo');
    expect(n()).toBe('3');
  });

  it('saves the state each step holds through the instrument serializer', async () => {
    const backing = new Map<string, unknown>();
    const first = await mount(backing);
    press('more');
    first.unmount();
    await waitFor(() => expect(stored(backing)?.undo).toBeDefined());
    const undo = stored(backing)?.undo as {
      trial: { undoStack: { forwardOps: { args: { before: { state: unknown } } }[] }[] };
    };
    expect(undo.trial.undoStack[0]?.forwardOps[0]?.args.before.state).toEqual({ count: 0 });
  });

  it('starts empty after a Reset, which clears the saved history too', async () => {
    const backing = new Map<string, unknown>();
    const first = await mount(backing);
    press('more');
    await waitFor(() => expect(stored(backing)?.undo).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Reset trial' }));
    first.unmount();
    await waitFor(() => expect(stored(backing)?.state).toEqual({ count: 0 }));
    expect(stored(backing)).not.toHaveProperty('undo');

    await mount(backing);
    expect(undoButton()).toBeDisabled();
  });

  it('opens a trial a version-4 labkit stored with nothing to undo', async () => {
    const backing = new Map<string, unknown>();
    const prefix = labPrefix(KEY);
    backing.set(`${prefix}meta`, { version: 4, mode: 'auto' });
    backing.set(`${prefix}${trialRecord('old')}`, {
      instrumentName: 'Counter',
      config: {},
      state: { count: 4 },
      view: null,
      order: 0,
    });
    await mount(backing);
    expect(n()).toBe('4');
    expect(undoButton()).toBeDisabled();
    press('more');
    press('Undo');
    expect(n()).toBe('4');
  });

  it('restores the stack another tab saved with the trial it wrote', async () => {
    const backing = new Map<string, unknown>();
    const seed = await mount(backing);
    seed.unmount();
    await waitFor(() => expect(stored(backing)).toBeDefined());

    const a = await mount(backing);
    const b = await mount(backing);
    const tabA = within(a.container);
    const tabB = within(b.container);
    press('more', tabA);
    press('more', tabA);
    await waitFor(() => expect(n(tabB)).toBe('2'), { timeout: 3000 });
    await waitFor(() => expect(undoButton(tabB)).toBeEnabled());
    press('Undo', tabB);
    expect(n(tabB)).toBe('1');
    press('Undo', tabB);
    expect(n(tabB)).toBe('0');
  });
});
