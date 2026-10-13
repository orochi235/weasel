import { fireEvent, render, screen, within } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlMatrix, type ControlMatrixColumn } from './ControlMatrix';

const flag = (name: string): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: true }) as PrefLeaf;
const num = (name: string): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 4 }) as PrefLeaf;

// The schema the settings live in, which the matrix is not drawn from.
const dialog: PrefGroup = {
  name: 'Dialog',
  children: {
    on: flag('On'),
    open: flag('Open'),
    view: { name: 'View', children: { size: num('Size') } },
  },
};

const look = () => ({
  glow: f.number(0.25).label('Glow').showIf({ path: 'on' }),
  rim: f.number(1).label('Rim').enableIf({ path: 'open' }),
  size: f.alias('view.size'),
  gate: f.alias('open'),
});
const schema = resolveConfigSchema(
  f.schema({ looks: f.group({ defaults: f.group(look()), window: f.group(look()) }) }),
  [],
  dialog,
);

const columns: ControlMatrixColumn[] = [
  { key: 'looks.defaults', label: 'Def', title: 'Defaults' },
  { key: 'looks.window', label: 'Win', title: 'Window' },
];
const rows = [
  { key: 'glow' },
  { key: 'rim' },
  { key: 'size', label: 'Size' },
  { key: 'gate', label: 'Gate' },
];
const held = { glow: 0.25, rim: 1 };

function setup(config: Record<string, unknown>) {
  const setConfig = vi.fn();
  render(
    <ControlMatrix
      schema={schema}
      over={dialog}
      columns={columns}
      rows={rows}
      config={{ looks: { defaults: held, window: held }, ...config }}
      auto={new Set()}
      setConfig={setConfig}
    />,
  );
  return setConfig;
}

describe('<ControlMatrix> over another schema', () => {
  it('shows and enables a cell by a pref of that schema, read at its default where the config holds nothing', () => {
    setup({});
    expect(screen.getByRole('button', { name: 'Defaults Glow' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Defaults Rim' })).toBeEnabled();
  });

  it("hides and disables a cell by that pref's value in the config", () => {
    setup({ on: false, open: false });
    expect(screen.queryByRole('button', { name: 'Defaults Glow' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Defaults Rim' })).toBeDisabled();
  });

  it("opens an alias's cell on the leaf of that schema, which writes at its path", () => {
    const setConfig = setup({ view: { size: 7 } });
    fireEvent.click(screen.getByRole('button', { name: 'Defaults Size' }));
    const field = within(screen.getByRole('dialog')).getByRole('spinbutton', { name: 'Size' });
    expect(field).toHaveValue('7');
    fireEvent.change(field, { target: { value: '9' } });
    fireEvent.blur(field);
    expect(setConfig).toHaveBeenCalledWith('view.size', 9);
  });

  it("summarizes an alias's cell from the leaf of that schema: its value, or its default", () => {
    setup({ view: { size: 7 } });
    expect(screen.getByRole('button', { name: 'Defaults Size' })).toHaveTextContent('7');
    expect(screen.getByRole('button', { name: 'Window Size' })).toHaveTextContent('7');
  });

  it("reads an alias's cell at the leaf's default where the config holds nothing", () => {
    setup({});
    expect(screen.getByRole('button', { name: 'Defaults Size' })).toHaveTextContent('4');
  });

  it("flips the leaf an alias's switch shows, at that leaf's path", () => {
    const setConfig = setup({});
    const gate = screen.getByRole('switch', { name: 'Window Gate' });
    expect(gate).toBeChecked();
    fireEvent.click(gate);
    expect(setConfig).toHaveBeenCalledWith('open', false);
  });

  it("offers no Inherit for an alias's cell, which holds no value of its own to give up", () => {
    const setConfig = setup({});
    fireEvent.click(screen.getByRole('switch', { name: 'Window Gate' }), { altKey: true });
    expect(setConfig).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Window Size' }));
    expect(
      within(screen.getByRole('dialog')).queryByRole('button', { name: 'Inherit' }),
    ).toBeNull();
  });
});
