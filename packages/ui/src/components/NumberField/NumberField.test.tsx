import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { NumberField } from './NumberField';
import { fieldClasses } from '../Field/Field';
import s from './NumberField.module.css';

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

  /** jsdom resolves no CSS and the module proxy answers to any key, so the
   *  class only proves the component asked for the fit rules — the painted
   *  width is a browser check. */
  describe("width='fit'", () => {
    function root(container: HTMLElement) {
      return container.querySelector('[data-rac]') as HTMLElement;
    }

    it('fills by default — no fit class', () => {
      const { container } = render(<NumberField aria-label="X" defaultValue={1} />);
      expect(root(container).classList.contains(s.fit)).toBe(false);
    });

    it('asks for the fit class when width is fit', () => {
      const { container } = render(<NumberField aria-label="X" width="fit" defaultValue={1} />);
      expect(root(container).classList.contains(s.fit)).toBe(true);
    });
  });

  it('threads placeholder to the input', () => {
    const { container } = render(<NumberField aria-label="X" value={NaN} placeholder="Mixed" />);
    expect(getInput(container)).toHaveAttribute('placeholder', 'Mixed');
  });
});

describe('NumberField orientation', () => {
  const css = readFileSync(resolve(__dirname, 'NumberField.module.css'), 'utf8');

  it('stacks the label above the field by default', () => {
    render(<NumberField label="Width" />);
    const root = screen.getByText('Width').closest(`.${fieldClasses.root}`)!;
    expect(root.className).not.toContain(fieldClasses.row);
  });

  it("sets the label beside the field with orientation='row', still labeling it", () => {
    render(<NumberField label="Width" orientation="row" />);
    const root = screen.getByText('Width').closest(`.${fieldClasses.root}`)!;
    expect(root.className).toContain(fieldClasses.row);
    expect(root.className).toContain(s.row);
    expect(screen.getByRole('textbox', { name: 'Width' })).toBeInstanceOf(HTMLInputElement);
  });

  it('keeps the label at its own width and lets description and error take a line of their own', () => {
    // (0,3,0) so Field's own `.row .label { flex: 1 }` cannot win on source order.
    expect(css).toMatch(/\.field\.row \.label\s*\{[^}]*flex:\s*0 0 auto/);
    expect(css).toMatch(/\.field\.row\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/\.field\.row \.below\s*\{[^}]*flex-basis:\s*100%/);
    expect(css).toMatch(/\.field\.row:not\(\.fit\) \.frame\s*\{[^}]*flex:\s*1 1 0/);
  });

  it('marks the label and the hint/error slots with the local classes the row rules key off', () => {
    const { container } = render(<NumberField label="Width" orientation="row" description="In pixels" />);
    expect(container.querySelector(`.${s.label}`)?.textContent).toBe('Width');
    expect(container.querySelector(`.${s.below}`)?.textContent).toBe('In pixels');
  });
});
