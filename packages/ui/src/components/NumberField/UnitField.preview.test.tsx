import { useState } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { UnitField } from './UnitField';

type Props = Partial<Parameters<typeof UnitField>[0]>;

/** A caller previewing through `onInput` into its own value, and committing on `onChange`. */
function previewing(start: number, props: Props = {}) {
  const onChange = vi.fn();
  const onInput = vi.fn();
  function Host() {
    const [value, setValue] = useState(start);
    return (
      <UnitField
        value={value}
        onInput={(v) => { onInput(v); setValue(v); }}
        onChange={(v) => { onChange(v); setValue(v); }}
        aria-label="Width"
        {...props}
      />
    );
  }
  render(<Host />);
  const field = screen.getByRole('spinbutton', { name: 'Width' });
  field.focus();
  return { onChange, onInput, field };
}

describe('UnitField previewed through onInput', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('commits a step that lands on the value typing previewed', () => {
    const { onChange, field } = previewing(50, { maxValue: 100 });
    fireEvent.change(field, { target: { value: '100' } });
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(100);
  });

  it('adds an offset to the value typing began from, not to the preview', () => {
    const { onChange, field } = previewing(10);
    fireEvent.change(field, { target: { value: '3' } });
    fireEvent.change(field, { target: { value: '+=3' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(13);
  });

  it('gives the starting value back before sending an offset to onOffset', () => {
    const calls: string[] = [];
    const { field } = previewing(10, { onOffset: (by) => calls.push(`offset ${by}`) });
    fireEvent.change(field, { target: { value: '5' } });
    fireEvent.change(field, { target: { value: '+=5' } });
    fireEvent.blur(field);
    expect(field).toHaveValue('10');
    expect(calls).toEqual(['offset 5']);
  });

  it('gives the starting value back when typing commits to where it began', () => {
    const { onChange, onInput, field } = previewing(10);
    fireEvent.change(field, { target: { value: '5' } });
    fireEvent.change(field, { target: { value: '+=0' } });
    fireEvent.blur(field);
    expect(onChange).not.toHaveBeenCalled();
    expect(onInput).toHaveBeenLastCalledWith(10);
    expect(field).toHaveValue('10');
  });
});
