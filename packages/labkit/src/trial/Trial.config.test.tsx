import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { f } from '../config/builder';
import type { ConfigRule, ControlRenderer } from '../config/types';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

const schemaInstrument = defineInstrument({
  name: 'Schema',
  config: f.schema({
    showGrid: f.boolean(true),
    cellSize: f.number(20).range(5, 80).step(5).label('Grid spacing'),
  }),
  initialState: () => ({}),
  render: () => null,
});

const legacyInstrument = defineInstrument({
  name: 'Legacy',
  defaultConfig: () => ({ showGrid: true }),
  configSchema: () => [
    { type: 'checkbox' as const, key: 'showGrid', label: 'Show grid', default: true },
  ],
  initialState: () => ({}),
  render: () => null,
});

describe('a trial renders its instrument config', () => {
  it('renders a builder schema into the settings sidebar', () => {
    render(<Lab instruments={[schemaInstrument]} defaultInstrument="Schema" />);
    expect(screen.getByLabelText('Show grid')).toBeInTheDocument();
    expect(screen.getByText('Grid spacing')).toBeInTheDocument();
  });

  it('renders a legacy ConfigField list through the same path', () => {
    render(<Lab instruments={[legacyInstrument]} defaultInstrument="Legacy" />);
    expect(screen.getByLabelText('Show grid')).toBeInTheDocument();
  });

  it('writes a config change back to the trial', () => {
    render(<Lab instruments={[schemaInstrument]} defaultInstrument="Schema" />);
    const checkbox = screen.getByLabelText('Show grid') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect((screen.getByLabelText('Show grid') as HTMLInputElement).checked).toBe(false);
  });
});

describe('lab-wide config seams', () => {
  it('applies a lab-wide rule before labkit inference', () => {
    const inst = defineInstrument({
      name: 'Ruled',
      config: f.schema({ tintColor: f.value('#ffffff') }),
      initialState: () => ({}),
      render: () => null,
    });
    const colorByName: ConfigRule = (ctx) => (ctx.key.endsWith('Color') ? { kind: 'color' } : null);
    render(<Lab instruments={[inst]} defaultInstrument="Ruled" configRules={[colorByName]} />);
    expect(screen.getByLabelText('Tint color')).toHaveAttribute('type', 'color');
  });

  it('without the rule the same leaf falls back to a text input', () => {
    const inst = defineInstrument({
      name: 'Unruled',
      config: f.schema({ tintColor: f.value('#ffffff') }),
      initialState: () => ({}),
      render: () => null,
    });
    render(<Lab instruments={[inst]} defaultInstrument="Unruled" />);
    expect(screen.getByLabelText('Tint color')).toHaveAttribute('type', 'text');
  });

  it('supplies a lab-wide control for a kind labkit does not ship', () => {
    const inst = defineInstrument({
      name: 'Custom',
      config: f.schema({ offset: f.custom('vector2', { x: 3 }) }),
      initialState: () => ({}),
      render: () => null,
    });
    const vector2: ControlRenderer = (ctx) => (
      <span>vec:{String((ctx.value as { x: number }).x)}</span>
    );
    render(<Lab instruments={[inst]} defaultInstrument="Custom" controls={{ vector2 }} />);
    expect(screen.getByText('vec:3')).toBeInTheDocument();
  });

  it('shows the placeholder when no control is supplied for that kind', () => {
    const inst = defineInstrument({
      name: 'Unwired',
      config: f.schema({ offset: f.custom('vector2', { x: 3 }) }),
      initialState: () => ({}),
      render: () => null,
    });
    render(<Lab instruments={[inst]} defaultInstrument="Unwired" />);
    expect(screen.getByText(/vector2/)).toBeInTheDocument();
  });

  it('omits the settings section for an instrument with no config', () => {
    const inst = defineInstrument({
      name: 'Bare',
      defaultConfig: () => ({}),
      initialState: () => ({}),
      render: () => null,
    });
    render(<Lab instruments={[inst]} defaultInstrument="Bare" />);
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });
});
