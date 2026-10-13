import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PropertyField } from './PropertyField';
import { compact, decimal, fraction } from '@weasel-js/quantity';

describe('slider field', () => {
  it('emits numeric value on change', () => {
    const onChange = vi.fn();
    render(<PropertyField kind="number" control="slider" label="Op" value={10} min={0} max={100} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  // A slider is controlled, so a test that drops the live value gets the DOM
  // value snapped back and cannot see what the release reports.
  function LiveSlider({
    onInput,
    onChange,
  }: {
    onInput?: (n: number) => void;
    onChange: (n: number) => void;
  }) {
    const [v, setV] = useState(10);
    const live = (n: number) => {
      setV(n);
      onInput?.(n);
    };
    return (
      <PropertyField
        kind="number"
        control="slider"
        label="Op"
        value={v}
        min={0}
        max={100}
        onInput={onInput ? live : undefined}
        onChange={
          onInput
            ? onChange
            : (n) => {
                setV(n);
                onChange(n);
              }
        }
      />
    );
  }

  it('reports moves to onInput and the release to onChange', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<LiveSlider onInput={onInput} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.input(slider, { target: { value: '42' } });
    expect(onInput).toHaveBeenCalledWith(42);
    expect(onChange).not.toHaveBeenCalled();
    // A drag ends with a bare `change` — the value it carries is the one the
    // last `input` already reported, which is why this one sets none.
    fireEvent.change(slider);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(42);
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it('keeps a lone onChange live, with no second call on release', () => {
    const onChange = vi.fn();
    render(<LiveSlider onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.input(slider, { target: { value: '42' } });
    fireEvent.change(slider);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('sends a typed readout through both halves of the pair', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<LiveSlider onInput={onInput} onChange={onChange} />);
    const readout = screen.getByRole('spinbutton');
    fireEvent.focus(readout);
    fireEvent.change(readout, { target: { value: '55' } });
    fireEvent.blur(readout);
    expect(onInput).toHaveBeenCalledWith(55);
    expect(onChange).toHaveBeenCalledWith(55);
  });

  it('shows a compact display, speaks it long, and reads a typed suffix back', () => {
    const onChange = vi.fn();
    render(
      <PropertyField
        kind="number"
        control="slider"
        label="Glyphs"
        value={2_000_000}
        min={0}
        max={2_000_000}
        step={1000}
        display={compact()}
        onChange={onChange}
      />,
    );
    const readout = screen.getByRole('spinbutton');
    expect(readout).toHaveValue('2.00M');
    expect(readout).toHaveAttribute('aria-valuetext', '2 million');
    fireEvent.focus(readout);
    fireEvent.change(readout, { target: { value: '2.5k' } });
    fireEvent.blur(readout);
    expect(onChange).toHaveBeenCalledWith(2500);
  });

  it('reverts an empty readout instead of committing zero', () => {
    const onChange = vi.fn();
    render(<PropertyField kind="number" control="slider" label="Op" value={10} min={0} max={100} onChange={onChange} />);
    const readout = screen.getByRole('spinbutton');
    fireEvent.focus(readout);
    fireEvent.change(readout, { target: { value: '' } });
    fireEvent.blur(readout);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('publishes the widest value its range can show', () => {
    render(<PropertyField kind="number" control="slider" label="Op" value={5} min={0} max={200_000} onChange={() => {}} />);
    // jsdom does no layout, so this reads the custom property the width is taken from.
    expect(screen.getByRole('spinbutton').style.getPropertyValue('--wzl-property-readout-fit')).toBe(
      '6ch',
    );
  });

  it('shows the readout through display', () => {
    render(
      <PropertyField
        kind="number"
        control="slider"
        label="Op"
        value={0.5}
        min={0}
        max={1}
        step={0.01}
        onChange={() => {}}
        display={decimal({ places: 2 })}
      />,
    );
    expect(screen.getByDisplayValue('0.50')).toBeInTheDocument();
  });

  it('reads typed text through display', () => {
    const onChange = vi.fn();
    render(
      <PropertyField
        kind="number"
        control="slider"
        label="Share"
        value={0.5}
        min={0}
        max={1}
        step={0.01}
        onChange={onChange}
        display={fraction()}
      />,
    );
    const readout = screen.getByRole('spinbutton');
    expect(readout).toHaveValue('1/2');
    expect(readout).toHaveAttribute('aria-valuetext', '1 over 2');
    fireEvent.focus(readout);
    fireEvent.change(readout, { target: { value: '1/4' } });
    fireEvent.blur(readout);
    expect(onChange).toHaveBeenCalledWith(0.25);
  });

  it('lets format override display for text no display expresses', () => {
    render(
      <PropertyField
        kind="number"
        control="slider"
        label="Radius"
        value={999}
        min={0}
        max={999}
        onChange={() => {}}
        display={decimal({ places: 2 })}
        format={(v) => (v >= 999 ? 'pill' : `${v}px`)}
      />,
    );
    expect(screen.getByRole('spinbutton')).toHaveValue('pill');
  });
});
