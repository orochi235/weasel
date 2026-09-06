import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { Select, SelectItem } from './Select';
import s from './Select.module.css';

const OPTIONS = [
  { value: 'r' as const, label: 'Red' },
  { value: 'g' as const, label: 'Green' },
  { value: 'b' as const, label: 'Blue' },
];

describe('Select', () => {
  it('renders a button trigger labeled by the select', () => {
    render(<Select label="Color" options={OPTIONS} placeholder="—" />);
    const trigger = screen.getByRole('button', { name: /Color/ });
    expect(trigger).toBeTruthy();
  });

  it('opens the listbox and selects on click, firing onSelectionChange', () => {
    const onChange = vi.fn();
    render(<Select label="Color" options={OPTIONS} onSelectionChange={onChange} />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Color/ })); });
    fireEvent.click(screen.getByRole('option', { name: 'Green' }));
    expect(onChange).toHaveBeenCalledWith('g');
  });

  it('renders the current selection in the trigger value', () => {
    render(<Select label="Color" options={OPTIONS} defaultSelectedKey="b" />);
    expect(screen.getByRole('button', { name: /Blue/ })).toBeTruthy();
  });

  it('supports the children form with explicit SelectItem rows', () => {
    const onChange = vi.fn();
    render(
      <Select label="Color" onSelectionChange={onChange}>
        <SelectItem id="r">Red</SelectItem>
        <SelectItem id="g">Green</SelectItem>
      </Select>,
    );
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Color/ })); });
    fireEvent.click(screen.getByRole('option', { name: 'Red' }));
    expect(onChange).toHaveBeenCalledWith('r');
  });

  it('renders the placeholder when no value selected', () => {
    render(<Select label="Color" options={OPTIONS} placeholder="Pick one" />);
    expect(screen.getByRole('button', { name: /Pick one/ })).toBeTruthy();
  });

  it('clears the trigger when a controlled selectedKey goes null', () => {
    const { rerender } = render(
      <Select label="Color" options={OPTIONS} selectedKey="b" placeholder="Mixed" onSelectionChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /Blue/ })).toBeTruthy();
    rerender(
      <Select label="Color" options={OPTIONS} selectedKey={null} placeholder="Mixed" onSelectionChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /Mixed/ })).toBeTruthy();
  });

  it('stays controlled with selectedKey null — a click does not move the trigger on its own', () => {
    const onChange = vi.fn();
    render(<Select label="Color" options={OPTIONS} selectedKey={null} placeholder="Mixed" onSelectionChange={onChange} />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Color/ })); });
    fireEvent.click(screen.getByRole('option', { name: 'Green' }));
    expect(onChange).toHaveBeenCalledWith('g');
    expect(screen.getByRole('button', { name: /Mixed/ })).toBeTruthy();
  });

  /** jsdom resolves no CSS and the module proxy answers to any key, so the
   *  class is a proxy for the width rules — the painted width is a browser
   *  check. What is real here is the sizer's content and its aria-hiding. */
  describe("width='fit'", () => {
    function root(container: HTMLElement) {
      return container.querySelector('[data-rac]') as HTMLElement;
    }

    it('fills by default — no fit class', () => {
      const { container } = render(<Select label="Color" options={OPTIONS} />);
      expect(root(container).classList.contains(s.fit)).toBe(false);
    });

    it('asks for the fit class when width is fit', () => {
      const { container } = render(<Select label="Color" options={OPTIONS} width="fit" />);
      expect(root(container).classList.contains(s.fit)).toBe(true);
    });

    it('measures against every option label and the placeholder', () => {
      const { container } = render(
        <Select label="Color" options={OPTIONS} placeholder="Pick one" width="fit" />,
      );
      const sizer = container.querySelector('[aria-hidden="true"].' + s.sizer) as HTMLElement;
      expect(Array.from(sizer.children).map((c) => c.textContent)).toEqual([
        'Pick one',
        'Red',
        'Green',
        'Blue',
      ]);
    });

    it('measures the children form off the row labels', () => {
      const { container } = render(
        <Select label="Color" width="fit">
          <SelectItem id="r">Red</SelectItem>
          <SelectItem id="v">Vermilion</SelectItem>
        </Select>,
      );
      const sizer = container.querySelector('.' + s.sizer) as HTMLElement;
      expect(Array.from(sizer.children).map((c) => c.textContent)).toEqual(['Red', 'Vermilion']);
    });

    it('keeps the hidden labels out of the trigger name', () => {
      render(<Select label="Color" options={OPTIONS} placeholder="Pick one" width="fit" />);
      expect(screen.getByRole('button', { name: 'Pick one Color' })).toBeTruthy();
    });
  });

  describe('textValue', () => {
    /** React Aria warns per row when it can't read a string off the
     *  children. Each row draws a check mark beside its label, so it never
     *  can — the string has to be supplied. */
    function warningsDuring(ui: React.ReactElement): string[] {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(ui);
      act(() => { fireEvent.click(screen.getByRole('button', { name: /Color/ })); });
      const messages = warn.mock.calls.map((c) => String(c[0]));
      warn.mockRestore();
      return messages.filter((m) => m.includes('textValue'));
    }

    it('derives it from a string label — no warning, nothing for callers to restate', () => {
      expect(warningsDuring(<Select label="Color" options={OPTIONS} />)).toEqual([]);
    });

    it('derives it from string children on an explicit row', () => {
      expect(warningsDuring(
        <Select label="Color">
          <SelectItem id="r">Red</SelectItem>
        </Select>,
      )).toEqual([]);
    });

    it('takes an explicit textValue for a label built from elements', () => {
      expect(warningsDuring(
        <Select
          label="Color"
          options={[{ value: 'r', label: <em>Red</em>, textValue: 'Red' }]}
        />,
      )).toEqual([]);
    });

    it('keeps type-to-select working off the derived value', () => {
      const onChange = vi.fn();
      render(<Select label="Color" options={OPTIONS} onSelectionChange={onChange} />);
      act(() => { fireEvent.click(screen.getByRole('button', { name: /Color/ })); });
      const listbox = screen.getByRole('listbox');
      act(() => { fireEvent.keyDown(listbox, { key: 'B' }); fireEvent.keyUp(listbox, { key: 'B' }); });
      expect(screen.getByRole('option', { name: 'Blue' })).toHaveAttribute('data-focused', 'true');
    });
  });
});
