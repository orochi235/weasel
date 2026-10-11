import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlMatrix, type ControlMatrixColumn } from './ControlMatrix';

const look = (key: string) => ({
  background: f.boolean(true).label('Background'),
  fill: f
    .color('#336699')
    .label('Fill')
    .enableIf({ path: `looks.${key}.background` }),
  glow: f
    .number(0.25)
    .label('Glow')
    .showIf({ path: `looks.${key}.background` }),
  edge: f
    .boolean(false)
    .label('Edge')
    .enableIf((c) => c.locked !== true),
  rim: f.number(1).label('Rim').showIf({ path: 'rims' }),
});

const schema = resolveConfigSchema(
  f.schema({
    locked: f.boolean(false),
    rims: f.boolean(false),
    looks: f.group({
      defaults: f.group(look('defaults')),
      window: f.group(look('window')).enableIf({ path: 'locked', is: false }),
    }),
  }),
  [],
);

const columns: ControlMatrixColumn[] = [
  { key: 'looks.defaults', label: 'Def', title: 'Defaults' },
  { key: 'looks.window', label: 'Win', title: 'Window' },
];
const rows = [
  { key: 'background' },
  { key: 'fill' },
  { key: 'glow' },
  { key: 'edge' },
  { key: 'rim' },
];
const held = { background: true, fill: '#336699', glow: 0.25, edge: false, rim: 1 };

function setup(config: Record<string, unknown>) {
  const setConfig = vi.fn();
  render(
    <ControlMatrix
      schema={schema}
      columns={columns}
      rows={rows}
      config={{ locked: false, rims: false, looks: { defaults: held, window: held }, ...config }}
      auto={new Set()}
      setConfig={setConfig}
    />,
  );
  return setConfig;
}

describe('ControlMatrix conditions', () => {
  it('draws no control in a cell whose showIf fails, and keeps the rest of its row', () => {
    setup({ looks: { defaults: held, window: { ...held, background: false } } });
    expect(screen.getByRole('button', { name: 'Defaults Glow' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Window Glow' })).toBeNull();
    expect(screen.getByRole('rowheader', { name: /Glow/ })).toBeInTheDocument();
  });

  it('draws no row for a setting hidden in every column, and draws it once it shows', () => {
    setup({});
    expect(screen.queryByRole('rowheader', { name: /Rim/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Defaults Rim' })).toBeNull();
  });

  it('draws the row once its setting shows in a column', () => {
    setup({ rims: true });
    expect(screen.getByRole('button', { name: 'Defaults Rim' })).toBeInTheDocument();
  });

  it('disables a cell whose enableIf fails, as data or as a function', () => {
    const setConfig = setup({
      locked: true,
      looks: { defaults: { ...held, background: false }, window: held },
    });
    expect(screen.getByLabelText('Defaults Fill')).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Defaults Edge' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Defaults Background' })).toBeEnabled();
    fireEvent.click(screen.getByRole('switch', { name: 'Defaults Edge' }));
    expect(setConfig).not.toHaveBeenCalled();
  });

  it('disables every cell of a column whose group is disabled, and opens no editor from one', () => {
    setup({ locked: true });
    expect(screen.getByRole('switch', { name: 'Window Background' })).toBeDisabled();
    const glow = screen.getByRole('button', { name: 'Window Glow' });
    expect(glow).toBeDisabled();
    fireEvent.click(glow);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Defaults Glow' })).toBeEnabled();
  });
});
