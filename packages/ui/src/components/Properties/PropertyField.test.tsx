import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { rotationDegreesUnit } from '@weasel-js/core';
import { prefFieldProps } from '../Prefs/prefField';
import type { PrefLeaf } from '../Prefs/schema';
import { PropertyControl, PropertyField } from './PropertyField';
import s from './Properties.module.css';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

describe('PropertyField mixed and unset', () => {
  it('draws a mixed checkbox indeterminate', () => {
    render(<PropertyField kind="boolean" label="Visible" value={undefined} mixed onChange={() => {}} />);
    const box = screen.getByRole('checkbox', { name: 'Visible' }) as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    expect(box.checked).toBe(false);
  });

  it('dims an unset switch, which has no form for it', () => {
    render(
      <PropertyField kind="boolean" control="switch" label="Snap" value={undefined} unset onChange={() => {}} />,
    );
    expect(screen.getByRole('switch', { name: 'Snap' }).closest('[title="Not set"]')).not.toBeNull();
  });

  it('leaves a mixed number empty and says so', () => {
    render(<PropertyField kind="number" label="Radius" value={4} mixed onChange={() => {}} />);
    const field = screen.getByRole('spinbutton', { name: 'Radius' });
    expect(field).toHaveValue(null);
    expect(field).toHaveAttribute('placeholder', 'Mixed');
  });

  it('parks a mixed slider and reads out no value', () => {
    render(
      <PropertyField
        kind="number"
        control="slider"
        label="Opacity"
        value={0.5}
        mixed
        min={0}
        max={1}
        step={0.01}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('slider', { name: 'Opacity' })).toBeDisabled();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Opacity' })).toBeNull();
  });

  it('chooses no option for an unset select, rather than its first', () => {
    render(<PropertyField kind="enum" label="Mode" value={undefined} unset options={OPTIONS} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Mode/ })).toHaveTextContent('—');
  });
});

describe('PropertyField text drafting', () => {
  it('reports each keystroke live and the settled text once', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<PropertyField kind="string" label="Name" value="a" onInput={onInput} onChange={onChange} />);
    const field = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(field, { target: { value: 'ab' } });
    fireEvent.change(field, { target: { value: 'abc' } });
    expect(field).toHaveValue('abc');
    expect(onInput.mock.calls).toEqual([['ab'], ['abc']]);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(onChange.mock.calls).toEqual([['abc']]);
  });

  it('settles on Enter, and commits nothing for an edit that changed nothing', () => {
    const onChange = vi.fn();
    render(<PropertyField kind="string" label="Name" value="a" onInput={() => {}} onChange={onChange} />);
    const field = screen.getByRole('textbox', { name: 'Name' });
    field.focus();
    fireEvent.change(field, { target: { value: 'a' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: 'b' } });
    field.focus();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onChange.mock.calls).toEqual([['b']]);
  });
});

describe('PropertyField enum segments', () => {
  it('draws a bare radio as segments that say which one is chosen', () => {
    const onChange = vi.fn();
    render(
      <PropertyField kind="enum" control="radio" label="Mode" value="a" options={OPTIONS} onChange={onChange} />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('draws a bare toggle as pressable segments', () => {
    render(
      <PropertyField kind="enum" control="toggle" label="Mode" value="b" options={OPTIONS} onChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('draws a framed radio as a radio group, with its disabled options', () => {
    render(
      <PropertyField
        kind="enum"
        control="radio"
        chrome="framed"
        label="Mode"
        value="a"
        options={[...OPTIONS, { value: 'c', label: 'Gamma', disabled: true }]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Alpha' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Gamma' })).toBeDisabled();
  });
});

describe('PropertyField color alpha', () => {
  it('keeps an alpha held in the hex through both the swatch and the track', () => {
    const onChange = vi.fn();
    render(<PropertyField kind="color" label="Tint" value="#336699cc" alpha onChange={onChange} />);
    expect(screen.getByLabelText('Tint', { selector: 'input[type="color"]' })).toHaveValue('#336699');
    fireEvent.change(screen.getByLabelText('Tint', { selector: 'input[type="color"]' }), {
      target: { value: '#00ff00' },
    });
    expect(onChange).toHaveBeenLastCalledWith('#00ff00cc');
    fireEvent.change(screen.getByRole('slider', { name: 'Tint opacity' }), { target: { value: '0.5' } });
    expect(onChange).toHaveBeenLastCalledWith('#33669980');
  });
});

describe('PropertyField framed chrome', () => {
  it('reads a unit typed into a framed number', () => {
    const onChange = vi.fn();
    render(
      <PropertyField
        kind="number"
        chrome="framed"
        label="Width"
        value={2}
        unit="cm"
        accepts={{ cm: 1, mm: 0.1 }}
        onChange={onChange}
      />,
    );
    const field = screen.getByRole('textbox', { name: 'Width' });
    fireEvent.change(field, { target: { value: '15mm' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith(1.5);
  });

  // A proxy: the CSS-module stub answers to any key, so this proves only that
  // the row asked for the class its bare-input rules skip, not that they do.
  it('marks its row framed', () => {
    const { container } = render(
      <PropertyField kind="string" chrome="framed" label="Name" value="a" onChange={() => {}} />,
    );
    expect(container.querySelector(`.${s.rowFramed}`)).not.toBeNull();
  });
});

describe('PropertyControl', () => {
  it('brings a slider its editable readout, with no row around them', () => {
    const onChange = vi.fn();
    const { container } = render(
      <PropertyControl kind="number" control="slider" name="Size" value={40} min={0} max={100} onChange={onChange} />,
    );
    expect(container.querySelector('label')).toBeNull();
    const readout = screen.getByRole('textbox', { name: 'Size' });
    fireEvent.focus(readout);
    fireEvent.change(readout, { target: { value: '70' } });
    fireEvent.blur(readout);
    expect(onChange).toHaveBeenCalledWith(70);
  });
});

describe('prefFieldProps', () => {
  const setValue = vi.fn();

  it('shows a number in its display unit and stores what comes back, clamped', () => {
    const leaf: PrefLeaf = {
      kind: 'number',
      name: 'Rotation',
      description: '',
      default: 0,
      min: 0,
      max: Math.PI,
      unit: rotationDegreesUnit,
    };
    const field = prefFieldProps(leaf, { value: Math.PI / 2, setValue });
    if (field?.kind !== 'number') throw new Error('expected a number field');
    expect(field.value).toBeCloseTo(90);
    expect(field.max).toBeCloseTo(180);
    field.onChange(270);
    expect(setValue.mock.lastCall?.[0]).toBeCloseTo(Math.PI);
  });

  it('reads and writes an enum through its encoding', () => {
    const leaf: PrefLeaf = {
      kind: 'enum',
      name: 'Dash',
      description: '',
      default: 'solid',
      options: [
        { value: 'solid', label: 'Solid' },
        { value: 'dashed', label: 'Dashed' },
      ],
      encoding: {
        read: (stored) => (Array.isArray(stored) ? 'dashed' : 'solid'),
        write: (option) => (option === 'dashed' ? [4, 2] : undefined),
      },
    };
    const field = prefFieldProps(leaf, { value: [4, 2], unset: false, setValue });
    if (field?.kind !== 'enum') throw new Error('expected an enum field');
    expect(field.value).toBe('dashed');
    field.onChange('solid');
    expect(setValue).toHaveBeenLastCalledWith(undefined);
  });

  it('leaves an object leaf and an app-defined kind to the surface', () => {
    const object: PrefLeaf = { kind: 'object', name: 'Stroke', description: '', default: {}, children: {} };
    const custom = { kind: 'registry-enum', name: 'Shape', description: '', default: 'rect' } as PrefLeaf;
    expect(prefFieldProps(object, { value: {}, setValue })).toBeNull();
    expect(prefFieldProps(custom, { value: 'rect', setValue })).toBeNull();
  });
});
