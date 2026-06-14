import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { RadioGroup, Radio } from './RadioGroup';

function Sample(props: { value?: string; onChange?: (v: string) => void; isDisabled?: boolean }) {
  return (
    <RadioGroup label="Color" value={props.value} onChange={props.onChange} isDisabled={props.isDisabled}>
      <Radio value="r">Red</Radio>
      <Radio value="g">Green</Radio>
      <Radio value="b">Blue</Radio>
    </RadioGroup>
  );
}

describe('RadioGroup', () => {
  it('exposes a radiogroup role with three radios', () => {
    render(<Sample />);
    expect(screen.getByRole('radiogroup')).toBeTruthy();
    expect(screen.getAllByRole('radio').length).toBe(3);
  });

  it('fires onChange with the selected value on click', () => {
    const onChange = vi.fn();
    render(<Sample onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Green'));
    expect(onChange).toHaveBeenCalledWith('g');
  });

  it('supports controlled value', () => {
    function Wrap() {
      const [v, setV] = useState('r');
      return <Sample value={v} onChange={setV} />;
    }
    render(<Wrap />);
    const green = screen.getByLabelText('Green') as HTMLInputElement;
    fireEvent.click(green);
    expect(green.checked).toBe(true);
  });

  it('marks all radios disabled when group is disabled', () => {
    render(<Sample isDisabled />);
    for (const r of screen.getAllByRole('radio') as HTMLInputElement[]) {
      expect(r.disabled).toBe(true);
    }
  });
});
