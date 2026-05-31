import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { NumberField } from './NumberField';

describe('NumberField', () => {
  function getInput(c: HTMLElement) {
    return c.querySelector('input') as HTMLInputElement;
  }

  it('renders the formatted value in the input', () => {
    const { container } = render(<NumberField label="Width" defaultValue={120} />);
    expect(getInput(container).value).toBe('120');
  });

  it('fires onChange with the parsed number on commit', () => {
    const onChange = vi.fn();
    const { container } = render(<NumberField label="X" defaultValue={1} onChange={onChange} />);
    const input = getInput(container);
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('supports controlled value', () => {
    function Wrap() {
      const [v, setV] = useState(10);
      return <NumberField label="Q" value={v} onChange={setV} />;
    }
    const { container } = render(<Wrap />);
    expect(getInput(container).value).toBe('10');
  });

  it('renders increment and decrement buttons by default', () => {
    const { container } = render(<NumberField label="X" defaultValue={0} />);
    expect(container.querySelector('[slot="increment"]')).toBeTruthy();
    expect(container.querySelector('[slot="decrement"]')).toBeTruthy();
  });

  it('omits steppers when hideSteppers is set', () => {
    const { container } = render(<NumberField label="X" hideSteppers defaultValue={0} />);
    expect(container.querySelector('[slot="increment"]')).toBeNull();
  });
});
