import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { Disabled, ReadOnly } from '../Disabled';
import { RadioGroup, Radio } from './RadioGroup';

function Sample(props: { value?: string; onChange?: (v: string) => void; disabled?: boolean }) {
  return (
    <RadioGroup label="Color" value={props.value} onChange={props.onChange} disabled={props.disabled}>
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
    render(<Sample disabled />);
    for (const r of screen.getAllByRole('radio') as HTMLInputElement[]) {
      expect(r.disabled).toBe(true);
    }
  });

  it('takes a ReadOnly scope around the group: radios stay reachable and refuse changes', () => {
    const onChange = vi.fn();
    render(<ReadOnly reason="Shared"><Sample onChange={onChange} /></ReadOnly>);
    const green = screen.getByLabelText('Green') as HTMLInputElement;
    expect(green.disabled).toBe(false);
    fireEvent.click(green);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('takes a Disabled scope around one choice inside the group', () => {
    const onChange = vi.fn();
    render(
      <RadioGroup label="Color" onChange={onChange}>
        <Radio value="r">Red</Radio>
        <Disabled reason="Out of stock"><Radio value="g">Green</Radio></Disabled>
      </RadioGroup>,
    );
    const green = screen.getByRole('radio', { name: 'Green' }) as HTMLInputElement;
    expect(green.disabled).toBe(true);
    expect(green).toHaveAccessibleDescription('Out of stock');
    fireEvent.click(screen.getByLabelText('Red'));
    expect(onChange).toHaveBeenCalledWith('r');
  });

  it('takes a ReadOnly scope around one choice inside the group', () => {
    const onChange = vi.fn();
    render(
      <RadioGroup label="Color" onChange={onChange}>
        <Radio value="r">Red</Radio>
        <ReadOnly><Radio value="g">Green</Radio></ReadOnly>
      </RadioGroup>,
    );
    expect((screen.getByRole('radio', { name: 'Green' }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Red'));
    expect(onChange).toHaveBeenCalledWith('r');
  });

  it('takes a Disabled scope around the group, through the group', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Disabled><Sample onChange={onChange} /></Disabled>);
    for (const r of screen.getAllByRole('radio') as HTMLInputElement[]) expect(r.disabled).toBe(true);
    rerender(<Disabled reason="Locked"><Sample onChange={onChange} /></Disabled>);
    const green = screen.getByLabelText('Green') as HTMLInputElement;
    expect(green.disabled).toBe(false);
    fireEvent.click(green);
    expect(onChange).not.toHaveBeenCalled();
  });
});
