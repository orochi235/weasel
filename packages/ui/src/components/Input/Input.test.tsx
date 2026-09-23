import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { Input } from './Input';
import { fieldClasses } from '../Field/Field';
import s from './Input.module.css';

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

describe('Input orientation', () => {
  const css = readFileSync(resolve(__dirname, 'Input.module.css'), 'utf8');

  it('stacks the label above the field by default', () => {
    render(<Input label="Width" />);
    const root = screen.getByText('Width').closest(`.${fieldClasses.root}`)!;
    expect(root.className).not.toContain(fieldClasses.row);
  });

  it("sets the label beside the field with orientation='row', still labeling it", () => {
    render(<Input label="Width" orientation="row" />);
    const root = screen.getByText('Width').closest(`.${fieldClasses.root}`)!;
    expect(root.className).toContain(fieldClasses.row);
    expect(root.className).toContain(s.row);
    expect(screen.getByLabelText('Width')).toBeInstanceOf(HTMLInputElement);
  });

  it('keeps the label at its own width and lets description and error take a line of their own', () => {
    // (0,3,0) so Field's own `.row .label { flex: 1 }` cannot win on source order.
    expect(css).toMatch(/\.field\.row \.label\s*\{[^}]*flex:\s*0 0 auto/);
    expect(css).toMatch(/\.field\.row\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/\.field\.row \.below\s*\{[^}]*flex-basis:\s*100%/);
    expect(css).toMatch(/\.field\.row \.frame\s*\{[^}]*flex:\s*1 1 0/);
  });

  it('marks the label and the hint/error slots with the local classes the row rules key off', () => {
    const { container } = render(<Input label="Width" orientation="row" description="In pixels" />);
    expect(container.querySelector(`.${s.label}`)?.textContent).toBe('Width');
    expect(container.querySelector(`.${s.below}`)?.textContent).toBe('In pixels');
  });
});
