import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Disclosure, DisclosureMark, DisclosureRow, type DisclosureProps } from './Disclosure';

describe('Disclosure', () => {
  it('reports its state through aria-expanded', () => {
    const { rerender } = render(<Disclosure open={false} onOpenChange={() => {}} label="Shapes" />);
    expect(screen.getByRole('button', { name: 'Shapes' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    rerender(<Disclosure open onOpenChange={() => {}} label="Shapes" />);
    expect(screen.getByRole('button', { name: 'Shapes' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('toggles on click', () => {
    const onOpenChange = vi.fn();
    render(<Disclosure open={false} onOpenChange={onOpenChange} label="Shapes" />);
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it('is a real button, which is what makes it keyboard-operable', () => {
    // Enter and Space are the browser's to deliver, and jsdom does not: firing
    // keydown here would prove nothing, and firing keydown *and* click would
    // pass against a div. What is checkable on this side is the element, and
    // `type="button"` so it never submits a form it is rendered inside.
    const button = render(
      <Disclosure open={false} onOpenChange={() => {}} label="Shapes" />,
    ).container.querySelector('button');
    expect(button?.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('points at the section it opens', () => {
    render(<Disclosure open onOpenChange={() => {}} label="Shapes" aria-controls="shapes-panel" />);
    expect(screen.getByRole('button', { name: 'Shapes' })).toHaveAttribute(
      'aria-controls',
      'shapes-panel',
    );
  });

  it('does not toggle while disabled', () => {
    const onOpenChange = vi.fn();
    render(<Disclosure open={false} onOpenChange={onOpenChange} label="Shapes" disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('draws the mark rather than typing it', () => {
    // The whole reason this component exists: `--wzl-font-ui` carries no ▸/▾,
    // so a text glyph falls back to the system font at the wrong size. A
    // character here would be the bug.
    const { container } = render(<Disclosure open={false} onOpenChange={() => {}} label="Shapes" />);
    const button = screen.getByRole('button', { name: 'Shapes' });
    expect(button.textContent).toBe('');
    expect(container.querySelector('svg path')).not.toBeNull();
  });

  it('hides the mark from the accessibility tree', () => {
    const { container } = render(<Disclosure open={false} onOpenChange={() => {}} label="Shapes" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('sizes the mark, and only the mark', () => {
    // The hit target is a custom property in the stylesheet, which jsdom does
    // not resolve — so this checks the half that is checkable: `size` reaches
    // the svg and nothing else.
    const { container } = render(
      <Disclosure open={false} onOpenChange={() => {}} label="Shapes" size={20} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
    expect(svg).toHaveAttribute('viewBox', '0 0 13 13');
  });
});

describe('DisclosureMark', () => {
  it('draws a plus while shut and a minus while open', () => {
    const d = (open: boolean) =>
      render(<DisclosureMark open={open} />).container.querySelector('path')?.getAttribute('d');
    expect(d(false)).toBe('M3 6.5 H10 M6.5 3 V10');
    expect(d(true)).toBe('M3 6.5 H10');
  });
});

describe('DisclosureRow', () => {
  it('puts the twisty outside the row content', () => {
    // The trap this layout exists to avoid: a twisty nested inside a row's
    // <label> actuates that label's control when clicked to expand.
    const onOpenChange = vi.fn();
    const onChange = vi.fn();
    render(
      <DisclosureRow open={false} onOpenChange={onOpenChange} label="Shapes">
        <label>
          <input type="checkbox" onChange={onChange} />
          <span>Shapes</span>
        </label>
      </DisclosureRow>,
    );
    const twisty = screen.getByRole('button', { name: 'Shapes' });
    expect(twisty.closest('label')).toBeNull();

    fireEvent.click(twisty);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("runs a caller's onClick before onOpenChange, and a prevented one skips it", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<Disclosure open={false} onOpenChange={onOpenChange} label="Shapes" onClick={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    rerender(<Disclosure open={false} onOpenChange={onOpenChange} label="Shapes" onClick={(e) => e.preventDefault()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it('passes native attributes through and forwards its ref', () => {
    const ref = createRef<HTMLButtonElement>();
    const onKeyDown = vi.fn();
    render(<Disclosure ref={ref} open onOpenChange={() => {}} label="Shapes" tabIndex={-1} onKeyDown={onKeyDown} data-row="3" />);
    const button = screen.getByRole('button', { name: 'Shapes' });
    expect(ref.current).toBe(button);
    expect(button).toHaveAttribute('tabindex', '-1');
    expect(button).toHaveAttribute('data-row', '3');
    fireEvent.keyDown(button, { key: 'ArrowLeft' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    // `open` owns it; JSX lets any hyphenated name through, so the type is what says it.
    expectTypeOf<DisclosureProps>().not.toHaveProperty('aria-expanded');
  });
});
