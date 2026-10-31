import { act, fireEvent, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { withValueAtPath } from '../config/path';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

const flag = (name: string, def: boolean): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: def }) as PrefLeaf;

// The app's preferences: the schema the instrument's config is drawn over.
const prefs: PrefGroup = {
  name: 'Preferences',
  children: { on: flag('On', true), view: { name: 'View', children: { grid: flag('Show grid', true) } } },
};

const seen: { on?: unknown; tight?: unknown } = {};
const gated = defineInstrument({
  name: 'Gated',
  config: f.schema(
    {
      tight: f.boolean(false).label('Tight').showIf({ path: 'on' }),
      grid: f.alias('view.grid'),
    },
    { over: prefs },
  ),
  initialState: () => ({}),
  render: (ctx) => {
    seen.on = ctx.over?.read('on');
    seen.tight = ctx.config.tight;
    return null;
  },
});

const mount = (over?: Parameters<typeof Lab>[0]['over']) =>
  renderSettled(<Lab instruments={[gated]} defaultInstrument="Gated" over={over} />, {
    wrapper: withIcons,
  });

describe("an instrument's config drawn over another schema", () => {
  it("shows and hides a row by a condition on that schema's setting, read from the lab's `over`", async () => {
    const shown = await mount({ values: { on: true }, set: vi.fn() });
    expect(screen.getByRole('checkbox', { name: 'Tight' })).toBeInTheDocument();
    expect(seen.on).toBe(true);
    shown.unmount();
    await mount({ values: { on: false }, set: vi.fn() });
    expect(screen.queryByRole('checkbox', { name: 'Tight' })).toBeNull();
    expect(seen.on).toBe(false);
  });

  it("writes an alias row to the lab's `over`, and its own rows to the trial", async () => {
    const set = vi.fn();
    await mount({ values: {}, set });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show grid' }));
    expect(set).toHaveBeenCalledWith('view.grid', false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tight' }));
    expect(set).toHaveBeenCalledTimes(1);
    expect(seen.tight).toBe(true);
  });

  it("re-renders the trial from the app's values when they change", async () => {
    let flip = (): void => {};
    function App() {
      const [values, setValues] = useState<Record<string, unknown>>({});
      flip = () => setValues((v) => withValueAtPath(v, 'on', false));
      return (
        <Lab
          instruments={[gated]}
          defaultInstrument="Gated"
          over={{ values, set: (p, v) => setValues((prev) => withValueAtPath(prev, p, v)) }}
        />
      );
    }
    await renderSettled(<App />, { wrapper: withIcons });
    expect(screen.getByRole('checkbox', { name: 'Tight' })).toBeInTheDocument();
    act(() => flip());
    expect(screen.queryByRole('checkbox', { name: 'Tight' })).toBeNull();
  });

  it('keeps the values itself, shared by its trials, where it is given no `over`', async () => {
    await mount();
    const grid = screen.getByRole('checkbox', { name: 'Show grid' });
    expect(grid).toBeChecked();
    fireEvent.click(grid);
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).not.toBeChecked();
  });
});
