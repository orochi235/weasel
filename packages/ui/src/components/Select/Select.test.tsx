import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, createEvent, screen, act } from '@testing-library/react';
import { Select, SelectItem, SelectSection } from './Select';
import s from './Select.module.css';
import { fieldClasses } from '../Field/Field';

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

  /** The caret is a real element, so its presence is a real claim. The
   *  underline is a CSS rule on a class the module proxy answers to either
   *  way — what these assert is which one the component asked for. */
  describe('indicator', () => {
    const root = (container: HTMLElement) => container.querySelector('[data-rac]') as HTMLElement;

    it('draws a caret on a boxed select', () => {
      const { container } = render(<Select label="Color" options={OPTIONS} />);
      expect(container.querySelector(`.${s.chevron}`)).not.toBeNull();
      expect(root(container).classList.contains(s.underlined)).toBe(false);
    });

    it('underlines the value instead on a bare one, where the caret costs more', () => {
      const { container } = render(<Select label="Color" options={OPTIONS} variant="bare" />);
      expect(container.querySelector(`.${s.chevron}`)).toBeNull();
      expect(root(container).classList.contains(s.underlined)).toBe(true);
    });

    it("takes an explicit indicator over the variant's own", () => {
      const { container } = render(
        <Select label="Color" options={OPTIONS} variant="bare" indicator="chevron" />,
      );
      expect(container.querySelector(`.${s.chevron}`)).not.toBeNull();
      expect(root(container).classList.contains(s.underlined)).toBe(false);
    });

    it('says nothing at all for indicator="none"', () => {
      const { container } = render(<Select label="Color" options={OPTIONS} indicator="none" />);
      expect(container.querySelector(`.${s.chevron}`)).toBeNull();
      expect(root(container).classList.contains(s.plain)).toBe(true);
    });
  });

  /** jsdom runs no pointer behavior of its own — React Aria's press handling
   *  is what opens the list, and nothing here re-targets the release onto a
   *  row. So the claim "the list stays open" cannot fail in this environment;
   *  what is assertable on this side of the boundary is that the opening
   *  release was suppressed, and the browser is what proves the rest. */
  describe('the click that opens it', () => {
    const press = (el: Element, init: object) =>
      fireEvent(el, new MouseEvent('pointerdown', { bubbles: true, ...init }));

    it('swallows the release that ends it', () => {
      render(<Select label="Color" options={OPTIONS} defaultSelectedKey="g" />);
      const trigger = screen.getByRole('button', { name: /Color/ });
      press(trigger, { clientX: 20, clientY: 10 });
      act(() => { fireEvent.click(trigger); });
      const up = createEvent.pointerUp(document, { clientX: 21, clientY: 11 });
      fireEvent(document, up);
      expect(up.defaultPrevented).toBe(true);
    });

    it('keeps every release after it', () => {
      render(<Select label="Color" options={OPTIONS} defaultSelectedKey="g" />);
      const trigger = screen.getByRole('button', { name: /Color/ });
      press(trigger, { clientX: 20, clientY: 10 });
      act(() => { fireEvent.click(trigger); });
      fireEvent(document, createEvent.pointerUp(document, { clientX: 21, clientY: 11 }));
      const second = createEvent.pointerUp(document, { clientX: 21, clientY: 11 });
      fireEvent(document, second);
      expect(second.defaultPrevented).toBe(false);
    });

    it('keeps a release that travelled — a drag onto a row is a choice', () => {
      render(<Select label="Color" options={OPTIONS} defaultSelectedKey="g" />);
      const trigger = screen.getByRole('button', { name: /Color/ });
      press(trigger, { clientX: 20, clientY: 10 });
      act(() => { fireEvent.click(trigger); });
      const up = createEvent.pointerUp(document, { clientX: 20, clientY: 60 });
      fireEvent(document, up);
      expect(up.defaultPrevented).toBe(false);
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

  describe('orientation', () => {
    const css = readFileSync(resolve(__dirname, 'Select.module.css'), 'utf8');

    it('stacks the label above the trigger by default', () => {
      render(<Select label="Bundle" options={OPTIONS} />);
      const root = screen.getByText('Bundle').closest(`.${fieldClasses.root}`)!;
      expect(root.className).not.toContain(fieldClasses.row);
    });

    it("sets the label beside the trigger with orientation='row', still labeling it", () => {
      render(<Select label="Bundle" orientation="row" options={OPTIONS} />);
      const root = screen.getByText('Bundle').closest(`.${fieldClasses.root}`)!;
      expect(root.className).toContain(fieldClasses.row);
      expect(root.className).toContain(s.row);
      expect(screen.getByRole('button', { name: /Bundle/ })).toBeTruthy();
    });

    it('keeps the label at its own width and lets description and error take a line of their own', () => {
      // (0,3,0) so Field's own `.row .label { flex: 1 }` cannot win on source order.
      expect(css).toMatch(/\.field\.row \.label\s*\{[^}]*flex:\s*0 0 auto/);
      expect(css).toMatch(/\.field\.row\s*\{[^}]*flex-wrap:\s*wrap/);
      expect(css).toMatch(/\.field\.row \.below\s*\{[^}]*flex-basis:\s*100%/);
    });

    it('marks the label and the hint/error slots with the local classes the row rules key off', () => {
      const { container } = render(
        <Select label="Bundle" orientation="row" description="Which bundle" options={OPTIONS} />,
      );
      expect(container.querySelector(`.${s.label}`)?.textContent).toBe('Bundle');
      expect(container.querySelector(`.${s.below}`)?.textContent).toBe('Which bundle');
    });
  });
});

describe('Select sections', () => {
  const open = () => act(() => { fireEvent.click(screen.getByRole('button', { name: /Font/ })); });

  it('groups SelectItem rows under a SelectSection title', () => {
    const onChange = vi.fn();
    render(
      <Select label="Font" onSelectionChange={onChange}>
        <SelectSection title="Sans">
          <SelectItem id="inter">Inter</SelectItem>
          <SelectItem id="arial">Arial</SelectItem>
        </SelectSection>
        <SelectSection title="Serif">
          <SelectItem id="garamond">Garamond</SelectItem>
        </SelectSection>
      </Select>,
    );
    open();
    const sans = screen.getByRole('group', { name: 'Sans' });
    expect(Array.from(sans.querySelectorAll('[role="option"]')).map((o) => o.textContent)).toEqual(['Inter', 'Arial']);
    fireEvent.click(screen.getByRole('option', { name: 'Garamond' }));
    expect(onChange).toHaveBeenCalledWith('garamond');
  });

  it('takes titled groups in the options form, beside plain options', () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Font"
        onSelectionChange={onChange}
        options={[
          { value: 'system', label: 'System' },
          { title: 'Sans', options: [{ value: 'inter', label: 'Inter' }] },
          { title: 'Serif', options: [{ value: 'garamond', label: 'Garamond' }] },
        ]}
      />,
    );
    open();
    expect(screen.getByRole('group', { name: 'Serif' }).textContent).toContain('Garamond');
    expect(screen.getByRole('option', { name: 'System' }).closest('[role="group"]')).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: 'Inter' }));
    expect(onChange).toHaveBeenCalledWith('inter');
  });

  it("sizes a width='fit' trigger against the options inside sections", () => {
    const { container } = render(
      <Select label="Font" width="fit" options={[{ title: 'Sans', options: [{ value: 'inter', label: 'Inter' }] }]} />,
    );
    const inOptions = container.querySelector('.' + s.sizer) as HTMLElement;
    expect(Array.from(inOptions.children).map((c) => c.textContent)).toEqual(['Inter']);
  });

  it("sizes a width='fit' trigger against SelectItems inside a SelectSection", () => {
    const { container } = render(
      <Select label="Font" width="fit">
        <SelectItem id="system">System</SelectItem>
        <SelectSection title="Serif">
          <SelectItem id="garamond">Garamond</SelectItem>
        </SelectSection>
      </Select>,
    );
    const sizer = container.querySelector('.' + s.sizer) as HTMLElement;
    expect(Array.from(sizer.children).map((c) => c.textContent)).toEqual(['System', 'Garamond']);
  });
});
