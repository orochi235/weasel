import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ControlPanel } from './ControlPanel';
import type { ConfigField } from './types';

describe('<ControlPanel> slider', () => {
  it('renders a range input with min/max/step and label', () => {
    const fields: ConfigField[] = [
      { key: 'freq', label: 'Frequency', type: 'slider', min: 0, max: 10, step: 0.5, default: 2 },
    ];
    render(<ControlPanel fields={fields} config={{ freq: 2 }} setConfig={vi.fn()} />);
    const input = screen.getByLabelText('Frequency') as HTMLInputElement;
    expect(input.type).toBe('range');
    expect(input.min).toBe('0');
    expect(input.max).toBe('10');
    expect(input.step).toBe('0.5');
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls setConfig with numeric value on change', () => {
    const setConfig = vi.fn();
    const fields: ConfigField[] = [
      { key: 'freq', label: 'Frequency', type: 'slider', min: 0, max: 10, default: 2 },
    ];
    render(<ControlPanel fields={fields} config={{ freq: 2 }} setConfig={setConfig} />);
    fireEvent.change(screen.getByLabelText('Frequency'), { target: { value: '5' } });
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
    const input = screen.getByLabelText('N');
    fireEvent.blur(input, { target: { value: '999' } });
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
  it('renders nothing for an unknown field type without crashing', () => {
    const fields = [
      { key: 'mystery', label: 'Mystery', type: 'mystery', default: 1 },
    ] as unknown as ConfigField[];
    const { container } = render(
      <ControlPanel fields={fields} config={{ mystery: 1 }} setConfig={vi.fn()} />,
    );
    expect(container.querySelector('.lk-control-panel')).not.toBeNull();
    expect(container.querySelector('.lk-control-row')).toBeNull();
  });
});
