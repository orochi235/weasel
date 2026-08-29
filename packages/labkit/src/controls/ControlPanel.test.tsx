import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';
import type { ConfigField } from './types';

describe('<ControlPanel> slider', () => {
  it('renders a range input with min/max/step and label', () => {
    const fields: ConfigField[] = [
      { key: 'freq', label: 'Frequency', type: 'slider', min: 0, max: 10, step: 0.5, default: 2 },
    ];
    render(<ControlPanel fields={fields} config={{ freq: 2 }} setConfig={vi.fn()} />);
    // The row holds two controls -- the range and an editable readout -- inside
    // one wrapping label, so query the slider by role rather than by label text.
    const input = screen.getByRole('slider') as HTMLInputElement;
    expect(input.min).toBe('0');
    expect(input.max).toBe('10');
    expect(input.step).toBe('0.5');
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('calls setConfig with numeric value on change', () => {
    const setConfig = vi.fn();
    const fields: ConfigField[] = [
      { key: 'freq', label: 'Frequency', type: 'slider', min: 0, max: 10, default: 2 },
    ];
    render(<ControlPanel fields={fields} config={{ freq: 2 }} setConfig={setConfig} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '5' } });
    expect(setConfig).toHaveBeenCalledWith('freq', 5);
  });
});

describe('<ControlPanel> checkbox', () => {
  it('renders checkbox with label and reflects config', () => {
    const fields: ConfigField[] = [{ key: 'on', label: 'On', type: 'checkbox', default: false }];
    render(<ControlPanel fields={fields} config={{ on: true }} setConfig={vi.fn()} />);
    const cb = screen.getByLabelText('On') as HTMLInputElement;
    expect(cb.type).toBe('checkbox');
    expect(cb.checked).toBe(true);
  });

  it('calls setConfig with boolean on change', () => {
    const setConfig = vi.fn();
    const fields: ConfigField[] = [{ key: 'on', label: 'On', type: 'checkbox', default: false }];
    render(<ControlPanel fields={fields} config={{ on: false }} setConfig={setConfig} />);
    fireEvent.click(screen.getByLabelText('On'));
    expect(setConfig).toHaveBeenCalledWith('on', true);
  });
});

describe('<ControlPanel> select', () => {
  it('renders options and dispatches selected value', () => {
    const setConfig = vi.fn();
    const fields: ConfigField[] = [
      {
        key: 'wave',
        label: 'Wave',
        type: 'select',
        default: 'sine',
        options: [
          { value: 'sine', label: 'Sine' },
          { value: 'square', label: 'Square' },
        ],
      },
    ];
    render(<ControlPanel fields={fields} config={{ wave: 'sine' }} setConfig={setConfig} />);
    const sel = screen.getByLabelText('Wave') as HTMLSelectElement;
    expect(sel.tagName).toBe('SELECT');
    fireEvent.change(sel, { target: { value: 'square' } });
    expect(setConfig).toHaveBeenCalledWith('wave', 'square');
  });
});

describe('<ControlPanel> number', () => {
  it('renders number input with initial value', () => {
    const fields: ConfigField[] = [
      { key: 'n', label: 'N', type: 'number', default: 0, min: 0, max: 100 },
    ];
    render(<ControlPanel fields={fields} config={{ n: 42 }} setConfig={vi.fn()} />);
    const input = screen.getByLabelText('N') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.value).toBe('42');
  });

  it('clamps to [min, max] on blur', () => {
    const setConfig = vi.fn();
    const fields: ConfigField[] = [
      { key: 'n', label: 'N', type: 'number', default: 0, min: 0, max: 100 },
    ];
    render(<ControlPanel fields={fields} config={{ n: 50 }} setConfig={setConfig} />);
    // The number row commits as you type, so the clamp applies on change
    // rather than waiting for blur.
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '999' } });
    expect(setConfig).toHaveBeenCalledWith('n', 100);
  });
});

describe('<ControlPanel> text', () => {
  it('renders text input with placeholder and maxLength', () => {
    const fields: ConfigField[] = [
      {
        key: 't',
        label: 'T',
        type: 'text',
        default: '',
        placeholder: 'type here',
        maxLength: 10,
      },
    ];
    render(<ControlPanel fields={fields} config={{ t: 'hi' }} setConfig={vi.fn()} />);
    const input = screen.getByLabelText('T') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.placeholder).toBe('type here');
    expect(input.maxLength).toBe(10);
  });

  it('calls setConfig live when debounceMs is 0', () => {
    const setConfig = vi.fn();
    const fields: ConfigField[] = [
      { key: 't', label: 'T', type: 'text', default: '', debounceMs: 0 },
    ];
    render(<ControlPanel fields={fields} config={{ t: '' }} setConfig={setConfig} />);
    fireEvent.change(screen.getByLabelText('T'), { target: { value: 'a' } });
    expect(setConfig).toHaveBeenCalledWith('t', 'a');
  });
});

describe('<ControlPanel> color', () => {
  it('renders a color input reflecting config and dispatches value', () => {
    const setConfig = vi.fn();
    const fields: ConfigField[] = [{ key: 'c', label: 'Color', type: 'color', default: '#000000' }];
    render(<ControlPanel fields={fields} config={{ c: '#ff0000' }} setConfig={setConfig} />);
    const input = screen.getByLabelText('Color') as HTMLInputElement;
    expect(input.type).toBe('color');
    expect(input.value).toBe('#ff0000');
    fireEvent.change(input, { target: { value: '#00ff00' } });
    expect(setConfig).toHaveBeenCalledWith('c', '#00ff00');
  });
});

describe('<ControlPanel> defensive', () => {
  it('names an unknown field type rather than dropping its row', () => {
    const fields = [
      { key: 'mystery', label: 'Mystery', type: 'mystery', default: 1 },
      { key: 'ok', label: 'Ok', type: 'checkbox', default: true },
    ] as unknown as ConfigField[];
    const { container } = render(
      <ControlPanel fields={fields} config={{ mystery: 1, ok: true }} setConfig={vi.fn()} />,
    );
    expect(container.querySelector('.lk-control-panel')).not.toBeNull();
    // A kind a lab has not wired up must not blank the panel, and a silently
    // dropped row reads as "this control does not exist".
    expect(screen.getByText(/mystery/)).toBeInTheDocument();
    expect(screen.getByLabelText('Ok')).toBeInTheDocument();
  });
});

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

  it('picks a slider for a bounded number and an input for an open one', () => {
    const schema = resolveConfigSchema(
      f.schema({ a: f.number(5).range(0, 10), b: f.number(5) }),
      [],
    );
    render(<ControlPanel schema={schema} config={{ a: 5, b: 5 }} setConfig={vi.fn()} />);
    expect(screen.getByLabelText('B')).toHaveAttribute('type', 'number');
  });

  it('falls back to the leaf default when config holds no value', () => {
    const schema = resolveConfigSchema(f.schema({ tint: f.color('#123456') }), []);
    render(<ControlPanel schema={schema} config={{}} setConfig={vi.fn()} />);
    expect(screen.getByLabelText('Tint')).toHaveValue('#123456');
  });
});

describe('<ControlPanel> renderers', () => {
  it('renderers[path] beats renderers[kind]', () => {
    const schema = resolveConfigSchema(f.schema({ tint: f.color('#ffffff') }), []);
    render(
      <ControlPanel
        schema={schema}
        config={{ tint: '#ffffff' }}
        setConfig={vi.fn()}
        renderers={{ color: () => <span>by-kind</span>, tint: () => <span>by-path</span> }}
      />,
    );
    expect(screen.getByText('by-path')).toBeInTheDocument();
    expect(screen.queryByText('by-kind')).not.toBeInTheDocument();
  });

  it('a lab renderer for the path beats the node\'s own .render', () => {
    const schema = resolveConfigSchema(
      f.schema({ tint: f.color('#ffffff').render(() => <span>by-node</span>) }),
      [],
    );
    render(
      <ControlPanel
        schema={schema}
        config={{ tint: '#ffffff' }}
        setConfig={vi.fn()}
        renderers={{ tint: () => <span>by-path</span> }}
      />,
    );
    expect(screen.getByText('by-path')).toBeInTheDocument();
  });

  it("a node's .render beats a lab renderer for the kind", () => {
    const schema = resolveConfigSchema(
      f.schema({ tint: f.color('#ffffff').render(() => <span>by-node</span>) }),
      [],
    );
    render(
      <ControlPanel
        schema={schema}
        config={{ tint: '#ffffff' }}
        setConfig={vi.fn()}
        renderers={{ color: () => <span>by-kind</span> }}
      />,
    );
    expect(screen.getByText('by-node')).toBeInTheDocument();
  });

  it('supplies a control for a kind labkit does not ship', () => {
    const schema = resolveConfigSchema(f.schema({ offset: f.custom('vector2', { x: 1 }) }), []);
    render(
      <ControlPanel
        schema={schema}
        config={{ offset: { x: 1 } }}
        setConfig={vi.fn()}
        renderers={{ vector2: (ctx) => <span>vec:{String((ctx.value as { x: number }).x)}</span> }}
      />,
    );
    expect(screen.getByText('vec:1')).toBeInTheDocument();
  });

  it('a renderer returning null collapses the row', () => {
    const schema = resolveConfigSchema(f.schema({ tint: f.color('#ffffff') }), []);
    const { container } = render(
      <ControlPanel
        schema={schema}
        config={{ tint: '#ffffff' }}
        setConfig={vi.fn()}
        renderers={{ color: () => null }}
      />,
    );
    expect(container.querySelector('.lk-property-row')).toBeNull();
  });
});

describe('<ControlPanel> visibility and sections', () => {
  it('hides a row whose showIf is false', () => {
    const schema = resolveConfigSchema(
      f.schema({
        showGrid: f.boolean(true),
        cellSize: f.number(20).showIf((c) => c.showGrid === true),
      }),
      [],
    );
    const { rerender } = render(
      <ControlPanel schema={schema} config={{ showGrid: true, cellSize: 20 }} setConfig={vi.fn()} />,
    );
    expect(screen.getByLabelText('Cell size')).toBeInTheDocument();
    rerender(
      <ControlPanel
        schema={schema}
        config={{ showGrid: false, cellSize: 20 }}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Cell size')).not.toBeInTheDocument();
  });

  it('keeps a hidden leaf out unless asked for it', () => {
    const schema = resolveConfigSchema(f.schema({ seed: f.number(0).hidden() }), []);
    const { rerender } = render(
      <ControlPanel schema={schema} config={{ seed: 0 }} setConfig={vi.fn()} />,
    );
    expect(screen.queryByLabelText('Seed')).not.toBeInTheDocument();
    rerender(<ControlPanel schema={schema} config={{ seed: 0 }} setConfig={vi.fn()} showHidden />);
    expect(screen.getByLabelText('Seed')).toBeInTheDocument();
  });

  it('groups sectioned leaves under a heading, ungrouped ones first', () => {
    const schema = resolveConfigSchema(
      f.schema({ showGrid: f.boolean(true), seed: f.number(0).section('Advanced') }),
      [],
    );
    const { container } = render(
      <ControlPanel schema={schema} config={{ showGrid: true, seed: 0 }} setConfig={vi.fn()} />,
    );
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    const group = container.querySelector('.lk-property-group');
    expect(group).not.toBeNull();
    expect(group?.textContent).toContain('Seed');
    expect(group?.textContent).not.toContain('Show grid');
  });
});
