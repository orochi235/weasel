import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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
});
