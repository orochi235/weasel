import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { Input } from './Input';

describe('Input', () => {
  it('renders label associated with the input', () => {
    render(<Input label="Width" placeholder="e.g. 120" />);
    const input = screen.getByLabelText('Width') as HTMLInputElement;
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input.placeholder).toBe('e.g. 120');
  });

  it('fires onChange with the new value as user types', () => {
    const onChange = vi.fn();
    render(<Input label="Name" onChange={onChange} />);
    const input = screen.getByLabelText('Name');
    fireEvent.change(input, { target: { value: 'Pico' } });
    expect(onChange).toHaveBeenCalledWith('Pico');
  });

  it('supports controlled value', () => {
    function Wrap() {
      const [v, setV] = useState('a');
      return <Input label="X" value={v} onChange={setV} />;
    }
    render(<Wrap />);
    const input = screen.getByLabelText('X') as HTMLInputElement;
    expect(input.value).toBe('a');
    fireEvent.change(input, { target: { value: 'ab' } });
    expect(input.value).toBe('ab');
  });

  it('renders description and error messages', () => {
    render(
      <Input
        label="Z"
        description="A hint."
        isInvalid
        errorMessage="Required"
      />,
    );
    expect(screen.getByText('A hint.')).toBeTruthy();
    expect(screen.getByText('Required')).toBeTruthy();
  });

  it('renders leading and trailing adornments', () => {
    render(
      <Input
        label="Size"
        leadingAdornment={<span data-testid="lead">$</span>}
        trailingAdornment={<span data-testid="trail">px</span>}
      />,
    );
    expect(screen.getByTestId('lead').textContent).toBe('$');
    expect(screen.getByTestId('trail').textContent).toBe('px');
  });
});
