import { useState } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, fireEvent, screen } from '@testing-library/react';
import { UnitField } from './UnitField';

const CM = { mm: 0.1, cm: 1, m: 100 };

function setup(props: Partial<Parameters<typeof UnitField>[0]> = {}) {
  const onChange = vi.fn();
  render(<UnitField value={5} onChange={onChange} accepts={CM} aria-label="Width" {...props} />);
  return { onChange, field: screen.getByRole('spinbutton', { name: 'Width' }) };
}

describe('UnitField', () => {
  it('shows the value', () => {
    expect(setup().field).toHaveValue('5');
  });

  it('shows an empty field and its placeholder for NaN', () => {
    const { field } = setup({ value: NaN, placeholder: 'Mixed' });
    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('placeholder', 'Mixed');
  });

  it('shows a mixed field empty, reading Mixed over its placeholder', () => {
    const { field } = setup({ value: 5, placeholder: 'Width', mixed: true });
    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('placeholder', 'Mixed');
    expect(field).not.toHaveAttribute('aria-valuenow');
  });

  it('commits a typed unit converted to the unit it shows', () => {
    const { onChange, field } = setup();
    fireEvent.change(field, { target: { value: '12mm' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith(1.2);
  });

  it('commits nothing for unreadable text, and shows the value again', () => {
    const { onChange, field } = setup();
    fireEvent.change(field, { target: { value: '12ft' } });
    fireEvent.blur(field);
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveValue('5');
  });

  it('commits once on Enter', () => {
    const { onChange, field } = setup();
    field.focus();
    fireEvent.change(field, { target: { value: '2m' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(200);
  });

  it('leaves an input method\'s Enter to it', () => {
    const { onChange, field } = setup();
    field.focus();
    fireEvent.change(field, { target: { value: '２' } });
    for (const init of [{ key: 'Enter', isComposing: true }, { key: 'Enter', keyCode: 229 }]) fireEvent.keyDown(field, init);
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveFocus();
  });

  it('commits nothing on Escape', () => {
    const { onChange, field } = setup();
    field.focus();
    fireEvent.change(field, { target: { value: '9' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveValue('5');
  });

  it('takes back on Escape what it sent while typing', () => {
    const onInput = vi.fn();
    const { onChange, field } = setup({ onInput });
    field.focus();
    fireEvent.change(field, { target: { value: '9' } });
    expect(onInput).toHaveBeenLastCalledWith(9);
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onInput).toHaveBeenLastCalledWith(5);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('takes back on blur what it sent before the text stopped reading', () => {
    const onInput = vi.fn();
    const { onChange, field } = setup({ onInput });
    field.focus();
    fireEvent.change(field, { target: { value: '9' } });
    fireEvent.change(field, { target: { value: '9x' } });
    expect(onInput).toHaveBeenLastCalledWith(9);
    fireEvent.blur(field);
    expect(onInput).toHaveBeenLastCalledWith(5);
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveValue('5');
  });

  describe('onCancel', () => {
    it('follows the value given back when typing ends in Escape', () => {
      const calls: string[] = [];
      const { field } = setup({ onInput: (v) => calls.push(`input ${v}`), onCancel: () => calls.push('cancel') });
      field.focus();
      fireEvent.change(field, { target: { value: '9' } });
      fireEvent.keyDown(field, { key: 'Escape' });
      expect(calls).toEqual(['input 9', 'input 5', 'cancel']);
    });

    it('is all a field that began with no value has to say, on Escape or on unreadable text', () => {
      const onInput = vi.fn();
      const onCancel = vi.fn();
      const { onChange, field } = setup({ value: NaN, onInput, onCancel });
      field.focus();
      fireEvent.change(field, { target: { value: '9' } });
      fireEvent.keyDown(field, { key: 'Escape' });
      expect(onInput.mock.calls).toEqual([[9]]);
      expect(onCancel).toHaveBeenCalledTimes(1);

      field.focus();
      fireEvent.change(field, { target: { value: '7' } });
      fireEvent.change(field, { target: { value: '7x' } });
      fireEvent.blur(field);
      expect(onCancel).toHaveBeenCalledTimes(2);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('stays quiet for a commit, and for typing that sent nothing', () => {
      const onCancel = vi.fn();
      const { field } = setup({ onInput: () => {}, onCancel });
      field.focus();
      fireEvent.change(field, { target: { value: '9' } });
      fireEvent.blur(field);
      field.focus();
      fireEvent.change(field, { target: { value: 'x' } });
      fireEvent.keyDown(field, { key: 'Escape' });
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  it('sends nothing on an unreadable blur when nothing was sent', () => {
    const onInput = vi.fn();
    const { field } = setup({ onInput });
    fireEvent.change(field, { target: { value: 'x' } });
    fireEvent.blur(field);
    expect(onInput).not.toHaveBeenCalled();
  });

  it('sends nothing on Escape when nothing was sent', () => {
    const onInput = vi.fn();
    const { field } = setup({ onInput });
    field.focus();
    fireEvent.change(field, { target: { value: 'x' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onInput).not.toHaveBeenCalled();
  });

  it('clamps to its bounds', () => {
    const { onChange, field } = setup({ minValue: 0, maxValue: 10 });
    fireEvent.change(field, { target: { value: '1m' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('steps with the arrow keys, from what is typed', () => {
    const { onChange, field } = setup({ step: 0.5 });
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(5.5);
    fireEvent.change(field, { target: { value: '20mm' } });
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(1.5);
  });
});

describe('UnitField compound values', () => {
  const imperialInInches = { in: 1, ft: 12, yd: 36 };

  it('commits a compound value as one number', async () => {
    const onChange = vi.fn();
    render(
      <UnitField value={12} onChange={onChange} accepts={imperialInInches} aria-label="Length" />,
    );
    const input = screen.getByLabelText('Length');
    fireEvent.change(input, { target: { value: '5ft 3in' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(63);
  });

  it('leaves the value alone when a term carries no unit', () => {
    const onChange = vi.fn();
    render(
      <UnitField value={12} onChange={onChange} accepts={imperialInInches} aria-label="Length" />,
    );
    const input = screen.getByLabelText('Length');
    fireEvent.change(input, { target: { value: '5ft 3' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('UnitField held stepper', () => {
  afterEach(() => { vi.useRealTimers(); });

  // The button is disabled at the bound while still held, and a disabled
  // button may never hear the release, so the repeat has to end on its own.
  it('stops repeating at the bound without waiting for the release', () => {
    vi.useFakeTimers();
    const onInput = vi.fn();
    function Host() {
      const [value, setValue] = useState(8);
      return <UnitField value={value} maxValue={10} steppers onChange={setValue} onInput={onInput} aria-label="Width" />;
    }
    render(<Host />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Increment' }));
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toHaveValue('10');
    onInput.mockClear();
    act(() => { vi.advanceTimersByTime(600); });
    expect(onInput).not.toHaveBeenCalled();
  });
});
