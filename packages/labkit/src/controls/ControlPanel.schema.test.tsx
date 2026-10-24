import { fireEvent, render, screen } from '@testing-library/react';
import { PREF_KINDS, type PrefKind, type PrefLeaf } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import type { ResolvedConfig } from '../config/types';
import { ControlPanel } from './ControlPanel';

describe('<ControlPanel> schema', () => {
  it('renders a schema through the built-in rows', () => {
    const schema = resolveConfigSchema(f.schema({ showGrid: f.boolean(true) }), []);
    render(<ControlPanel schema={schema} config={{ showGrid: true }} setConfig={vi.fn()} />);
    expect(screen.getByLabelText('Show grid')).toBeInTheDocument();
  });

  it('writes back through setConfig keyed by path', () => {
    const setConfig = vi.fn();
    const schema = resolveConfigSchema(f.schema({ showGrid: f.boolean(true) }), []);
    render(<ControlPanel schema={schema} config={{ showGrid: true }} setConfig={setConfig} />);
    fireEvent.click(screen.getByLabelText('Show grid'));
    expect(setConfig).toHaveBeenCalledWith('showGrid', false);
  });

  it('draws a switch for a toggle() leaf and a checkbox for a plain one', () => {
    const setConfig = vi.fn();
    const schema = resolveConfigSchema(
      f.schema({ showGrid: f.boolean(true), snap: f.boolean(true).toggle() }),
      [],
    );
    render(
      <ControlPanel
        schema={schema}
        config={{ showGrid: true, snap: false }}
        setConfig={setConfig}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeInTheDocument();
    const sw = screen.getByRole('switch', { name: 'Snap' });
    expect(sw).toBeInTheDocument();
    fireEvent.click(sw);
    expect(setConfig).toHaveBeenCalledWith('snap', true);
  });

  it('picks a slider for a bounded number and an input for an open one', () => {
    const schema = resolveConfigSchema(
      f.schema({ a: f.number(5).range(0, 10), b: f.number(5) }),
      [],
    );
    render(<ControlPanel schema={schema} config={{ a: 5, b: 5 }} setConfig={vi.fn()} />);
    expect(screen.getAllByRole('slider')).toHaveLength(1);
    expect(screen.getByLabelText('B')).toHaveAttribute('role', 'spinbutton');
  });

  it('falls back to the leaf default when config holds no value', () => {
    const schema = resolveConfigSchema(f.schema({ tint: f.color('#123456') }), []);
    render(<ControlPanel schema={schema} config={{}} setConfig={vi.fn()} />);
    expect(screen.getByLabelText('Tint')).toHaveValue('#123456');
  });

  it('gives a described leaf\u2019s description to its control, and leaves an undescribed leaf bare', () => {
    const schema = resolveConfigSchema(
      f.schema({
        showGrid: f.boolean(true).describe('Draw the alignment grid.'),
        snap: f.boolean(true),
      }),
      [],
    );
    render(
      <ControlPanel schema={schema} config={{ showGrid: true, snap: true }} setConfig={vi.fn()} />,
    );
    expect(screen.queryByText('ⓘ')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toHaveAccessibleDescription(
      'Draw the alignment grid.',
    );
    expect(screen.getByRole('checkbox', { name: 'Snap' })).not.toHaveAttribute('aria-describedby');
  });
});

describe('<ControlPanel> built-in kind coverage', () => {
  const KIND = 'spline' as PrefKind;
  afterEach(() => {
    delete (PREF_KINDS as Record<string, true>)[KIND];
  });

  const schemaWith = (...leaves: PrefLeaf[]): ResolvedConfig => ({
    group: {
      name: 'root',
      children: Object.fromEntries(leaves.map((leaf, i) => [`k${i}`, leaf])),
    },
    sections: [],
    showIf: new Map(),
    renderers: {},
    dialogs: {},
  });

  it('declines paint with a named row rather than a blank one, and opens an object in a dialog', () => {
    render(
      <ControlPanel
        schema={schemaWith(
          { kind: 'paint', name: 'Fill', description: '', default: null },
          {
            kind: 'object',
            name: 'Stroke',
            description: '',
            default: {},
            children: { width: { kind: 'number', name: 'Width', description: '', default: 1 } },
          },
        )}
        config={{}}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.getByText(/no control for .paint./)).toBeInTheDocument();
    expect(screen.queryByText(/no control for .object./)).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Stroke' })).toBeInTheDocument();
  });

  it('throws for a built-in kind with no case arm', () => {
    (PREF_KINDS as Record<string, true>)[KIND] = true;
    expect(() =>
      render(
        <ControlPanel
          schema={schemaWith({ kind: KIND, name: 'Curve', description: '', default: null })}
          config={{}}
          setConfig={vi.fn()}
        />,
      ),
    ).toThrow(/spline/);
  });
});

describe('<ControlPanel> nested groups', () => {
  const nested = () =>
    resolveConfigSchema(
      f.schema({
        showGrid: f.boolean(true),
        grid: f.group({ size: f.number(20).label('Cell size'), color: f.color('#ffffff') }),
      }),
      [],
    );

  it('renders a nested group under its own heading', () => {
    render(
      <ControlPanel
        schema={nested()}
        config={{ showGrid: true, grid: { size: 20, color: '#ffffff' } }}
        setConfig={vi.fn()}
      />,
    );
    const group = screen.getByRole('heading', { name: 'Grid' }).parentElement;
    expect(group?.textContent).toContain('Cell size');
  });

  it('reads a nested leaf value out of the config tree', () => {
    render(
      <ControlPanel
        schema={nested()}
        config={{ showGrid: true, grid: { size: 44, color: '#ffffff' } }}
        setConfig={vi.fn()}
      />,
    );
    expect((screen.getByLabelText('Cell size') as HTMLInputElement).value).toBe('44');
  });

  it('falls back to the leaf default when the branch is missing', () => {
    render(<ControlPanel schema={nested()} config={{ showGrid: true }} setConfig={vi.fn()} />);
    expect((screen.getByLabelText('Cell size') as HTMLInputElement).value).toBe('20');
  });

  it('writes back with the full dotted path', () => {
    const setConfig = vi.fn();
    render(
      <ControlPanel
        schema={nested()}
        config={{ showGrid: true, grid: { size: 20, color: '#ffffff' } }}
        setConfig={setConfig}
      />,
    );
    fireEvent.change(screen.getByLabelText('Cell size'), { target: { value: '40' } });
    fireEvent.blur(screen.getByLabelText('Cell size'));
    expect(setConfig).toHaveBeenCalledWith('grid.size', 40);
  });

  it('hides a whole group whose showIf is false', () => {
    const schema = resolveConfigSchema(
      f.schema({
        showGrid: f.boolean(true),
        grid: f.group({ size: f.number(20).label('Cell size') }).showIf((c) => c.showGrid === true),
      }),
      [],
    );
    render(
      <ControlPanel
        schema={schema}
        config={{ showGrid: false, grid: { size: 20 } }}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Cell size')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Grid' })).not.toBeInTheDocument();
  });

  it('takes a renderer keyed by the nested path', () => {
    const schema = nested();
    render(
      <ControlPanel
        schema={schema}
        config={{ showGrid: true, grid: { size: 44, color: '#ffffff' } }}
        setConfig={vi.fn()}
        renderers={{ 'grid.size': (ctx) => <span>size:{String(ctx.value)}</span> }}
      />,
    );
    expect(screen.getByText('size:44')).toBeInTheDocument();
  });
});
