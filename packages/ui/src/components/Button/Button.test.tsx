import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children and fires onClick', () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Button onClick={onClick}>Save</Button>);
    const btn = getByRole('button');
    expect(btn.textContent).toContain('Save');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <Button onClick={onClick} disabled>Save</Button>,
    );
    fireEvent.click(getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('sets aria-busy when loading', () => {
    const { getByRole } = render(<Button loading>Saving…</Button>);
    expect(getByRole('button').getAttribute('aria-busy')).toBe('true');
  });

  it('omits aria-busy when not loading', () => {
    const { getByRole } = render(<Button>Save</Button>);
    expect(getByRole('button').getAttribute('aria-busy')).toBeNull();
  });

  it('defaults type to "button"', () => {
    const { getByRole } = render(<Button>Save</Button>);
    expect(getByRole('button').getAttribute('type')).toBe('button');
  });

  it('honors explicit type', () => {
    const { getByRole } = render(<Button type="submit">Submit</Button>);
    expect(getByRole('button').getAttribute('type')).toBe('submit');
  });

  it('activates on Enter and Space (native button behavior)', () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Button onClick={onClick}>Go</Button>);
    const btn = getByRole('button');
    btn.focus();
    fireEvent.keyDown(btn, { key: 'Enter' });
    fireEvent.click(btn);
    fireEvent.keyDown(btn, { key: ' ' });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('applies variant and size classes', () => {
    const { getByRole } = render(
      <Button variant="primary" size="sm">P</Button>,
    );
    const cls = getByRole('button').className;
    expect(cls).toMatch(/variant_primary/);
    expect(cls).toMatch(/size_sm/);
  });

  it('iconOnly requires ariaLabel and applies aria-label', () => {
    const { getByRole } = render(
      <Button iconOnly ariaLabel="Add"><span>+</span></Button>,
    );
    const btn = getByRole('button');
    expect(btn.getAttribute('aria-label')).toBe('Add');
    expect(btn.className).toMatch(/iconOnly/);
  });

  it('renders leading and trailing icons', () => {
    const { getByRole } = render(
      <Button
        leadingIcon={<span data-testid="lead">L</span>}
        trailingIcon={<span data-testid="trail">T</span>}
      >
        Mid
      </Button>,
    );
    const btn = getByRole('button');
    expect(btn.querySelector('[data-testid="lead"]')).not.toBeNull();
    expect(btn.querySelector('[data-testid="trail"]')).not.toBeNull();
  });

  it('replaces leading icon with spinner when loading', () => {
    const { getByRole } = render(
      <Button loading leadingIcon={<span data-testid="lead">L</span>}>Saving</Button>,
    );
    const btn = getByRole('button');
    expect(btn.querySelector('[data-testid="lead"]')).toBeNull();
    expect(btn.querySelector('svg')).not.toBeNull();
  });

  it('applies fullWidth class when set', () => {
    const { getByRole } = render(<Button fullWidth>X</Button>);
    expect(getByRole('button').className).toMatch(/fullWidth/);
  });

  it('reports a pressed state only when it is a toggle', () => {
    const { getByRole, rerender } = render(<Button pressed={false}>Legend</Button>);
    expect(getByRole('button').getAttribute('aria-pressed')).toBe('false');
    rerender(<Button pressed>Legend</Button>);
    expect(getByRole('button').getAttribute('aria-pressed')).toBe('true');
    // An action button must announce none at all -- `false` reads as a toggle
    // that happens to be off.
    rerender(<Button>Save</Button>);
    expect(getByRole('button').getAttribute('aria-pressed')).toBeNull();
  });

  describe('link variant', () => {
    const css = readFileSync(resolve(__dirname, 'Button.module.css'), 'utf8');
    const rule = (sel: string) => {
      const m = css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
      return m?.[2] ?? '';
    };

    it('renders a real button with the link variant class', () => {
      const onClick = vi.fn();
      const { getByRole } = render(<Button variant="link" onClick={onClick}>open</Button>);
      const btn = getByRole('button');
      expect(btn.className).toMatch(/variant_link/);
      fireEvent.click(btn);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('paints its text with the accent-as-text token, not the accent fill', () => {
      const body = rule('.variant_link');
      expect(body).toMatch(/color:\s*var\(--wzl-accent-fg\)/);
      expect(body).not.toMatch(/--wzl-accent\)/);
    });

    it('drops the control box so it sits in running text', () => {
      const body = rule('.variant_link');
      expect(body).toMatch(/height:\s*auto/);
      expect(body).toMatch(/padding:\s*0/);
      expect(body).toMatch(/background:\s*transparent/);
      expect(body).toMatch(/font:\s*inherit/);
      expect(css).toMatch(/\.variant_link::before\s*\{\s*display:\s*none/);
    });
  });
});

/** Enter keyboard modality, then focus — RAC only opens tooltips on focus-visible. */
function keyboardFocus(el: HTMLElement) {
  fireEvent.keyDown(document.body, { key: 'Tab' });
  act(() => el.focus());
}

describe('Button tooltip', () => {
  it('shows the shortcut after a string label', () => {
    render(<Button shortcut="⌘S">Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    keyboardFocus(btn);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Save (⌘S)');
    expect(btn.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('names an icon-only button by ariaLabel', () => {
    render(<Button iconOnly ariaLabel="Undo" shortcut="⌘Z"><svg /></Button>);
    keyboardFocus(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('tooltip').textContent).toContain('Undo (⌘Z)');
  });

  it('lets tooltip replace the default text', () => {
    render(<Button tooltip="Write to disk" shortcut="⌘S">Save</Button>);
    keyboardFocus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip').textContent).toContain('Write to disk');
  });

  it('adds no tooltip without either field', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button');
    keyboardFocus(btn);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(btn.getAttribute('aria-describedby')).toBeNull();
  });
});
