import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, fireEvent, act, screen } from '@testing-library/react';
import { Badge } from './Badge';
import { Focusable, Tooltip, TooltipTrigger } from '../Tooltip';

describe('Badge', () => {
  it('renders label as a span by default', () => {
    const { container, getByText } = render(<Badge>hello</Badge>);
    expect(getByText('hello')).toBeDefined();
    expect(container.firstElementChild?.tagName).toBe('SPAN');
  });

  it('applies status via data-status attribute, with no peer tone', () => {
    const { container } = render(<Badge status="accent">x</Badge>);
    expect(container.firstElementChild?.getAttribute('data-status')).toBe('accent');
    expect(container.firstElementChild?.hasAttribute('data-tone')).toBe(false);
    expect(container.firstElementChild?.hasAttribute('data-stance')).toBe(false);
  });

  it('takes a peer tone and a stance beside its status, merged with its own style', () => {
    const { container } = render(
      <Badge status="warn" stance="notice" tone={1} style={{ marginLeft: 4 }}>x</Badge>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.dataset.status).toBe('warn');
    expect(el.dataset.stance).toBe('notice');
    expect(el.dataset.tone).toBe('1');
    expect(el.style.getPropertyValue('--wzl-tone')).toBe('var(--wzl-swatch-green)');
    expect(el.style.marginLeft).toBe('4px');
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

  it('paints the success status from --wzl-success', () => {
    const { container } = render(<Badge status="success">ok</Badge>);
    expect(container.firstElementChild?.getAttribute('data-status')).toBe('success');
    expect(css).toMatch(/\.badge\[data-status='success'\]\s*\{\s*--badge-status-edge: var\(--wzl-success\);/);
  });

  it('paints a peer tone or a stance accent over the status, and keys no status off data-tone', () => {
    expect(css).toMatch(/--badge-edge: var\(--_s-accent, var\(--badge-status-edge\)\);/);
    expect(css).not.toMatch(/\[data-tone='/);
  });

  it('sizes xs from the 2xs type step', () => {
    const { container } = render(<Badge size="xs">3</Badge>);
    expect(container.firstElementChild?.getAttribute('data-size')).toBe('xs');
    expect(css).toMatch(/\.badge\[data-size='xs'\]\s*\{[^}]*--badge-font-size: var\(--wzl-font-size-2xs\);/);
  });
});

/** Enter keyboard modality, then focus — RAC only opens tooltips on focus-visible. */
function keyboardFocus(el: HTMLElement) {
  fireEvent.keyDown(document.body, { key: 'Tab' });
  act(() => el.focus());
}

describe('Badge as a tooltip trigger', () => {
  it('forwards its ref and DOM attributes to the root element', () => {
    const ref = createRef<HTMLElement>();
    const onFocus = vi.fn();
    const { container } = render(
      <Badge ref={ref} id="b1" data-kind="predicate" title="t" onFocus={onFocus} tabIndex={0}>x</Badge>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(ref.current).toBe(el);
    expect(el.id).toBe('b1');
    expect(el.getAttribute('data-kind')).toBe('predicate');
    expect(el.getAttribute('title')).toBe('t');
    fireEvent.focus(el);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(el.getAttribute('data-focused')).toBe('true');
  });

  it('opens a kit tooltip under TooltipTrigger and Focusable', () => {
    render(
      <TooltipTrigger>
        <Focusable>
          <Badge role="img" aria-label="Predicate">?</Badge>
        </Focusable>
        <Tooltip>Matched by a predicate</Tooltip>
      </TooltipTrigger>,
    );
    const badge = screen.getByRole('img', { name: 'Predicate' });
    keyboardFocus(badge);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Matched by a predicate');
    expect(badge.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('makes a plain badge a focusable trigger with the tooltip prop', () => {
    render(<Badge tooltip="Matched by a predicate">?</Badge>);
    const badge = screen.getByRole('img', { name: '?' });
    expect(badge.tagName).toBe('SPAN');
    expect(badge.tabIndex).toBe(0);
    keyboardFocus(badge);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Matched by a predicate');
    expect(badge.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('keeps an interactive badge a button when it has a tooltip', () => {
    render(<Badge tooltip="Filter by tag" onClick={() => {}}>tag</Badge>);
    const badge = screen.getByRole('button', { name: 'tag' });
    keyboardFocus(badge);
    expect(screen.getByRole('tooltip').textContent).toContain('Filter by tag');
  });
});
