import { act, fireEvent, screen, within } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { icon } from '../icons.gen';
import { ControlPanel } from './ControlPanel';
import type { ConfigField } from './types';

describe('<ControlPanel> slider', () => {
  it('renders a range input with min/max/step and label', () => {
    const fields: ConfigField[] = [
      { key: 'freq', label: 'Frequency', type: 'slider', min: 0, max: 10, step: 0.5, default: 2 },
    ];
    renderWithIcons(<ControlPanel fields={fields} config={{ freq: 2 }} setConfig={vi.fn()} />);
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
    renderWithIcons(<ControlPanel fields={fields} config={{ freq: 2 }} setConfig={setConfig} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '5' } });
    expect(setConfig).toHaveBeenCalledWith('freq', 5);
  });
});

describe('<ControlPanel> checkbox', () => {
  it('renders checkbox with label and reflects config', () => {
    const fields: ConfigField[] = [{ key: 'on', label: 'On', type: 'checkbox', default: false }];
    renderWithIcons(<ControlPanel fields={fields} config={{ on: true }} setConfig={vi.fn()} />);
    const cb = screen.getByLabelText('On') as HTMLInputElement;
    expect(cb.type).toBe('checkbox');
    expect(cb.checked).toBe(true);
  });

  it('calls setConfig with boolean on change', () => {
    const setConfig = vi.fn();
    const fields: ConfigField[] = [{ key: 'on', label: 'On', type: 'checkbox', default: false }];
    renderWithIcons(<ControlPanel fields={fields} config={{ on: false }} setConfig={setConfig} />);
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
    renderWithIcons(
      <ControlPanel fields={fields} config={{ wave: 'sine' }} setConfig={setConfig} />,
    );
    const trigger = screen.getByRole('button', { name: 'Sine Wave' });
    expect(trigger).toHaveTextContent('Sine');
    act(() => {
      fireEvent.click(trigger);
    });
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Square' }));
    expect(setConfig).toHaveBeenCalledWith('wave', 'square');
  });
});

describe('<ControlPanel> number', () => {
  it('renders number input with initial value', () => {
    const fields: ConfigField[] = [
      { key: 'n', label: 'N', type: 'number', default: 0, min: 0, max: 100 },
    ];
    renderWithIcons(<ControlPanel fields={fields} config={{ n: 42 }} setConfig={vi.fn()} />);
    const input = screen.getByLabelText('N') as HTMLInputElement;
    expect(input).toHaveAttribute('role', 'spinbutton');
    expect(input.value).toBe('42');
  });

  it('clamps to [min, max] what is typed', () => {
    const setConfig = vi.fn();
    const fields: ConfigField[] = [
      { key: 'n', label: 'N', type: 'number', default: 0, min: 0, max: 100 },
    ];
    renderWithIcons(<ControlPanel fields={fields} config={{ n: 50 }} setConfig={setConfig} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '999' } });
    fireEvent.blur(screen.getByRole('spinbutton'));
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
    renderWithIcons(<ControlPanel fields={fields} config={{ t: 'hi' }} setConfig={vi.fn()} />);
    const input = screen.getByLabelText('T') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.placeholder).toBe('type here');
    expect(input.maxLength).toBe(10);
  });

  it('drafts every keystroke when debounceMs is 0', () => {
    const draftConfig = vi.fn();
    const fields: ConfigField[] = [
      { key: 't', label: 'T', type: 'text', default: '', debounceMs: 0 },
    ];
    renderWithIcons(
      <ControlPanel
        fields={fields}
        config={{ t: '' }}
        setConfig={vi.fn()}
        draftConfig={draftConfig}
      />,
    );
    fireEvent.change(screen.getByLabelText('T'), { target: { value: 'a' } });
    expect(draftConfig).toHaveBeenCalledWith('t', 'a');
  });
});

describe('<ControlPanel> color', () => {
  it('renders a color input reflecting config and dispatches value', () => {
    const setConfig = vi.fn();
    const fields: ConfigField[] = [{ key: 'c', label: 'Color', type: 'color', default: '#000000' }];
    renderWithIcons(
      <ControlPanel fields={fields} config={{ c: '#ff0000' }} setConfig={setConfig} />,
    );
    const input = screen.getByLabelText('Color') as HTMLInputElement;
    expect(input.type).toBe('color');
    expect(input.value).toBe('#ff0000');
    fireEvent.input(input, { target: { value: '#00ff00' } });
    expect(setConfig).toHaveBeenCalledWith('c', '#00ff00');
  });
});

describe('<ControlPanel> defensive', () => {
  it('names an unknown field type rather than dropping its row', () => {
    const fields = [
      { key: 'mystery', label: 'Mystery', type: 'mystery', default: 1 },
      { key: 'ok', label: 'Ok', type: 'checkbox', default: true },
    ] as unknown as ConfigField[];
    const { container } = renderWithIcons(
      <ControlPanel fields={fields} config={{ mystery: 1, ok: true }} setConfig={vi.fn()} />,
    );
    expect(container.querySelector('.lk-control-panel')).not.toBeNull();
    // A kind a lab has not wired up must not blank the panel, and a silently
    // dropped row reads as "this control does not exist".
    expect(screen.getByText(/mystery/)).toBeInTheDocument();
    expect(screen.getByLabelText('Ok')).toBeInTheDocument();
  });
});

describe('<ControlPanel> option icons', () => {
  it('draws an enum asked for as a toggle with every option at once, and says so to the forms that read the leaf', () => {
    const camera = f.enum('3d', ['2d', '3d']).toggle();
    const schema = resolveConfigSchema(f.schema({ camera }), []);
    renderWithIcons(
      <ControlPanel schema={schema} config={{ camera: '3d' }} setConfig={() => {}} />,
    );
    expect(screen.getByRole('radio', { name: '3d' })).toBeInTheDocument();
    expect(schema.group.children.camera).toMatchObject({ control: 'toggle' });
  });

  it("draws an option's icon in its segment and keeps the label as its name", () => {
    const status = f
      .enum('ok', [
        { value: 'ok', label: 'ok', icon: icon('ui:statusSuccess') },
        { value: 'bad', label: 'bad' },
      ])
      .radio();
    renderWithIcons(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ status }), [])}
        config={{ status: 'ok' }}
        setConfig={() => {}}
      />,
    );
    const ok = screen.getByRole('radio', { name: 'ok' });
    expect(ok.querySelector('svg')).not.toBeNull();
    expect(ok.textContent).toBe('');
    expect(screen.getByRole('radio', { name: 'bad' }).textContent).toBe('bad');
  });

  it("draws an option's icon beside its label in a select's trigger and list", () => {
    const status = f.enum('ok', [
      { value: 'ok', label: 'ok', icon: icon('ui:statusSuccess') },
      { value: 'bad', label: 'bad' },
    ]);
    renderWithIcons(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ status }), [])}
        config={{ status: 'ok' }}
        setConfig={() => {}}
      />,
    );
    const trigger = screen.getByRole('button', { name: /ok/ });
    expect(trigger.querySelector('[aria-hidden="true"] > svg')).not.toBeNull();
    expect(trigger).toHaveTextContent('ok');
    act(() => {
      fireEvent.click(trigger);
    });
    expect(
      screen.getByRole('option', { name: 'ok' }).querySelector('[aria-hidden="true"] > svg'),
    ).not.toBeNull();
    expect(screen.getByRole('option', { name: 'bad' }).querySelectorAll('svg')).toHaveLength(1);
  });
});

describe('<ControlPanel> color alpha', () => {
  const panel = (setConfig = vi.fn(), stored = '#336699cc') => {
    renderWithIcons(
      <ControlPanel
        schema={resolveConfigSchema(
          f.schema({ tint: f.color('#000000ff').alpha().label('Tint') }),
          [],
        )}
        config={{ tint: stored }}
        setConfig={setConfig}
      />,
    );
    return setConfig;
  };

  it('splits the stored hex into a swatch and an alpha track', () => {
    panel();
    expect((screen.getByLabelText('Tint') as HTMLInputElement).value).toBe('#336699');
    expect((screen.getByLabelText('Tint opacity') as HTMLInputElement).value).toBe('80');
  });

  it('keeps the stored alpha when the swatch moves', () => {
    const setConfig = panel();
    fireEvent.input(screen.getByLabelText('Tint'), { target: { value: '#00ff00' } });
    expect(setConfig).toHaveBeenCalledWith('tint', '#00ff00cc');
  });

  it('keeps the stored color when the alpha track moves', () => {
    const setConfig = panel();
    fireEvent.input(screen.getByLabelText('Tint opacity'), { target: { value: '50' } });
    expect(setConfig).toHaveBeenCalledWith('tint', '#33669980');
  });

  it('leaves a color leaf without alpha as a bare swatch', () => {
    renderWithIcons(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ tint: f.color('#336699').label('Tint') }), [])}
        config={{ tint: '#336699' }}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Tint opacity')).toBeNull();
  });
});
