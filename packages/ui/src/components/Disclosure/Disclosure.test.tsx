import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Disclosure, DisclosureRow } from './Disclosure';

describe('Disclosure', () => {
  it('reports its state through aria-expanded', () => {
    const { rerender } = render(<Disclosure open={false} onToggle={() => {}} label="Shapes" />);
    expect(screen.getByRole('button', { name: 'Shapes' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    rerender(<Disclosure open onToggle={() => {}} label="Shapes" />);
    expect(screen.getByRole('button', { name: 'Shapes' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('toggles on click', () => {
    const onToggle = vi.fn();
    render(<Disclosure open={false} onToggle={onToggle} label="Shapes" />);
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('is a real button, which is what makes it keyboard-operable', () => {
    // Enter and Space are the browser's to deliver, and jsdom does not: firing
    // keydown here would prove nothing, and firing keydown *and* click would
    // pass against a div. What is checkable on this side is the element, and
    // `type="button"` so it never submits a form it is rendered inside.
    const button = render(
      <Disclosure open={false} onToggle={() => {}} label="Shapes" />,
    ).container.querySelector('button');
    expect(button?.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('points at the section it opens', () => {
    render(<Disclosure open onToggle={() => {}} label="Shapes" controls="shapes-panel" />);
    expect(screen.getByRole('button', { name: 'Shapes' })).toHaveAttribute(
      'aria-controls',
      'shapes-panel',
    );
  });

  it('does not toggle while disabled', () => {
    const onToggle = vi.fn();
    render(<Disclosure open={false} onToggle={onToggle} label="Shapes" disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('draws the mark rather than typing it', () => {
    // The whole reason this component exists: `--wzl-font-ui` carries no ▸/▾,
    // so a text glyph falls back to the system font at the wrong size. A
    // character here would be the bug.
    const { container } = render(<Disclosure open={false} onToggle={() => {}} label="Shapes" />);
    const button = screen.getByRole('button', { name: 'Shapes' });
    expect(button.textContent).toBe('');
    expect(container.querySelector('svg path')).not.toBeNull();
  });

  it('hides the mark from the accessibility tree', () => {
    const { container } = render(<Disclosure open={false} onToggle={() => {}} label="Shapes" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('sizes the mark, and only the mark', () => {
    // The hit target is a custom property in the stylesheet, which jsdom does
    // not resolve — so this checks the half that is checkable: `size` reaches
    // the svg and nothing else.
    const { container } = render(
      <Disclosure open={false} onToggle={() => {}} label="Shapes" size={20} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
    expect(svg).toHaveAttribute('viewBox', '0 0 12 12');
  });
});

describe('DisclosureRow', () => {
  it('puts the twisty outside the row content', () => {
    // The trap this layout exists to avoid: a twisty nested inside a row's
    // <label> actuates that label's control when clicked to expand.
    const onToggle = vi.fn();
    const onChange = vi.fn();
    render(
      <DisclosureRow open={false} onToggle={onToggle} label="Shapes">
        <label>
          <input type="checkbox" onChange={onChange} />
          <span>Shapes</span>
        </label>
      </DisclosureRow>,
    );
    const twisty = screen.getByRole('button', { name: 'Shapes' });
    expect(twisty.closest('label')).toBeNull();

    fireEvent.click(twisty);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });
});
