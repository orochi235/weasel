import { fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

const flag = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: true, ...extra }) as PrefLeaf;

// The schema the settings live in, which the panel is not drawn from.
const dialog: PrefGroup = {
  name: 'Dialog',
  children: {
    on: flag('On'),
    open: flag('Open'),
    view: {
      name: 'View',
      showIf: { path: 'on' },
      children: { grid: flag('Show grid', { enableIf: { path: 'open' } }) },
    },
  },
};
const schema = resolveConfigSchema(
  f.schema({
    play: f.group({
      grid: f.alias('view.grid'),
      named: f.alias('view.grid').label('Grid while playing'),
    }),
  }),
  [],
);

const draw = (config: Record<string, unknown>, over?: PrefGroup, setConfig = vi.fn()) =>
  render(<ControlPanel schema={schema} over={over} config={config} setConfig={setConfig} />);

describe('<ControlPanel> over another schema', () => {
  it("draws an alias as the leaf of that schema at its path, where the panel's own holds none", () => {
    const alone = draw({});
    expect(screen.getAllByText('(alias: no control at view.grid)')).toHaveLength(2);
    alone.unmount();
    draw({}, dialog);
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Grid while playing' })).toBeChecked();
  });

  it("reads the leaf's value at its path in the config, and writes there", () => {
    const setConfig = vi.fn();
    draw({ view: { grid: false } }, dialog, setConfig);
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show grid' }));
    expect(setConfig).toHaveBeenCalledWith('view.grid', true);
  });

  it('leaves the alias out while a group above its leaf in that schema is not shown, and disables it while the leaf is', () => {
    const hidden = draw({ on: false }, dialog);
    expect(screen.queryByRole('checkbox', { name: 'Show grid' })).toBeNull();
    hidden.unmount();
    const closed = draw({ open: false }, dialog);
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeDisabled();
    closed.unmount();
    draw({}, dialog);
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeEnabled();
  });
});
