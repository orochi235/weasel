import { screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

const panel = (schema: ReturnType<typeof resolveConfigSchema>, config: Record<string, unknown>) => (
  <ControlPanel schema={schema} config={config} setConfig={vi.fn()} />
);

describe('<ControlPanel> headings over nothing', () => {
  it('draws no section heading while every row under it is hidden', () => {
    const schema = resolveConfigSchema(
      f.schema({
        on: f.boolean(false),
        seed: f.number(0).section('Advanced').showIf({ path: 'on', is: true }),
        rate: f.number(1).section('Advanced').hidden(),
      }),
    );
    const { rerender } = renderWithIcons(panel(schema, { on: false, seed: 0, rate: 1 }));
    expect(screen.queryByText('Advanced')).not.toBeInTheDocument();
    rerender(panel(schema, { on: true, seed: 0, rate: 1 }));
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('draws no section heading over a group whose rows are all hidden', () => {
    const schema = resolveConfigSchema(
      f.schema({
        on: f.boolean(false),
        grid: f.group({ size: f.number(4).showIf({ path: 'on', is: true }) }).section('Layout'),
      }),
    );
    renderWithIcons(panel(schema, { on: false, grid: { size: 4 } }));
    expect(screen.queryByText('Layout')).not.toBeInTheDocument();
    expect(screen.queryByText('Grid')).not.toBeInTheDocument();
  });

  it('draws no group heading while every row under it is hidden', () => {
    const schema = resolveConfigSchema(
      f.schema({
        on: f.boolean(false),
        grid: f.group({ size: f.number(4).showIf({ path: 'on', is: true }) }),
      }),
    );
    const { rerender } = renderWithIcons(panel(schema, { on: false, grid: { size: 4 } }));
    expect(screen.queryByText('Grid')).not.toBeInTheDocument();
    rerender(panel(schema, { on: true, grid: { size: 4 } }));
    expect(screen.getByText('Grid')).toBeInTheDocument();
  });
});
