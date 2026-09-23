import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders label as a span by default', () => {
    const { container, getByText } = render(<Badge>hello</Badge>);
    expect(getByText('hello')).toBeDefined();
    expect(container.firstElementChild?.tagName).toBe('SPAN');
  });

  it('applies tone via data-tone attribute', () => {
    const { container } = render(<Badge tone="accent">x</Badge>);
    expect(container.firstElementChild?.getAttribute('data-tone')).toBe('accent');
  });

  it('applies variant via data-variant attribute', () => {
    const { container } = render(<Badge variant="solid">x</Badge>);
    expect(container.firstElementChild?.getAttribute('data-variant')).toBe('solid');
  });

  it('applies size via data-size attribute', () => {
    const { container } = render(<Badge size="md">x</Badge>);
    expect(container.firstElementChild?.getAttribute('data-size')).toBe('md');
  });

  it('renders an svg decoration layer for SVG-rendered shapes', () => {
    const { container } = render(<Badge shape="square">x</Badge>);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('omits the svg decoration layer for CSS-rendered shapes', () => {
    const { container } = render(<Badge shape="plain">x</Badge>);
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('Badge content slots', () => {
  it('applies shape insets as CSS custom properties', () => {
    const { container } = render(<Badge shape="notched">x</Badge>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.getPropertyValue('--badge-inset-left')).toBe('4px');
    expect(el.style.getPropertyValue('--badge-inset-right')).toBe('4px');
  });
});

describe('Badge interactive', () => {
  it('renders as button when onClick given', () => {
    const { container } = render(<Badge onClick={() => {}}>x</Badge>);
    expect(container.firstElementChild?.tagName).toBe('BUTTON');
  });

  it('renders as anchor when href given', () => {
    const { container } = render(<Badge href="/x">x</Badge>);
    expect(container.firstElementChild?.tagName).toBe('A');
  });

  it('honors explicit as override', () => {
    const { container } = render(<Badge as="button">x</Badge>);
    expect(container.firstElementChild?.tagName).toBe('BUTTON');
  });

  it('fires onClick when clicked', () => {
    const fn = vi.fn();
    const { container } = render(<Badge onClick={fn}>x</Badge>);
    (container.firstElementChild as HTMLButtonElement).click();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('renders focus path when focus-visible matches', () => {
    const { container } = render(<Badge onClick={() => {}}>x</Badge>);
    const btn = container.firstElementChild as HTMLButtonElement;
    fireEvent.focus(btn);
    expect(btn.getAttribute('data-focused')).toBe('true');
  });
});

describe('Badge removable', () => {
  it('renders remove button when onRemove provided', () => {
    const { getByRole } = render(<Badge onRemove={() => {}}>x</Badge>);
    expect(getByRole('button', { name: 'Remove' })).toBeDefined();
  });

  it('fires onRemove without firing wrapper onClick', () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    const { getByRole } = render(
      <Badge onClick={onClick} onRemove={onRemove}>x</Badge>,
    );
    (getByRole('button', { name: 'Remove' }) as HTMLButtonElement).click();
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('honors removeLabel override', () => {
    const { getByRole } = render(
      <Badge onRemove={() => {}} removeLabel="Dismiss">x</Badge>,
    );
    expect(getByRole('button', { name: 'Dismiss' })).toBeDefined();
  });
});

// jsdom resolves no var() and the CSS-module proxy answers any key, so these
// read the stylesheet as text — a proxy for the rules existing at all.
describe('Badge stylesheet', () => {
  const css = readFileSync(resolve(__dirname, 'Badge.module.css'), 'utf8');

  it('paints the success tone from --wzl-success', () => {
    const { container } = render(<Badge tone="success">ok</Badge>);
    expect(container.firstElementChild?.getAttribute('data-tone')).toBe('success');
    expect(css).toMatch(/\.badge\[data-tone='success'\]\s*\{\s*--badge-edge: var\(--wzl-success\);/);
  });

  it('sizes xs from the 2xs type step', () => {
    const { container } = render(<Badge size="xs">3</Badge>);
    expect(container.firstElementChild?.getAttribute('data-size')).toBe('xs');
    expect(css).toMatch(/\.badge\[data-size='xs'\]\s*\{[^}]*--badge-font-size: var\(--wzl-font-size-2xs\);/);
  });
});
