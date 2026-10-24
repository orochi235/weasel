import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, fireEvent, act, screen } from '@testing-library/react';
import { Badge, type BadgeProps } from './Badge';
import { Focusable, Tooltip, TooltipTrigger } from '../Tooltip';

describe('Badge', () => {
  it('renders label as a span by default', () => {
    const { container, getByText } = render(<Badge>hello</Badge>);
    expect(getByText('hello')).toBeDefined();
    expect(container.firstElementChild?.tagName).toBe('SPAN');
  });

  it('marks grade and emphasis, never a status', () => {
    const { container } = render(<Badge grade="warn" emphasis="low">x</Badge>);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.dataset).toMatchObject({ grade: 'warn', emphasis: 'low' });
    expect(badge.dataset.status).toBeUndefined();
    expect(badge.hasAttribute('data-tint')).toBe(false);
    expect(badge.hasAttribute('data-stance')).toBe(false);
  });

  it('takes a tint and a stance beside its grade, merged with its own style', () => {
    const { container } = render(
      <Badge grade="warn" stance="debug" tint={1} style={{ marginLeft: 4 }}>x</Badge>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.dataset.grade).toBe('warn');
    expect(el.dataset.stance).toBe('debug');
    expect(el.dataset.tint).toBe('1');
    expect(el.style.getPropertyValue('--wzl-tint')).not.toBe('');
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

  // jsdom lays nothing out, so the content's size is stubbed: this pins that the insets take
  // the composed outline into account, not that the content clears it on screen.
  describe('on a base fitted to its content', () => {
    const inset = (props: Partial<BadgeProps>) => {
      const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockReturnValue({ width: 200, height: 14, left: 0, top: 0, right: 200, bottom: 14, x: 0, y: 0, toJSON: () => ({}) });
      const { container } = render(<Badge base="quatrefoil" {...props}>a long enough label</Badge>);
      rect.mockRestore();
      return parseFloat((container.firstElementChild as HTMLElement).style.getPropertyValue('--badge-inset-left'));
    };

    it('pads further for a negative bloat', () => {
      expect(inset({ bloat: -3 })).toBeGreaterThanOrEqual(inset({}) + 3);
    });

    it('pads further for an effect that cuts into the outline, and no further for one that does not', () => {
      expect(inset({ effects: [{ type: 'bites', params: { biteRadius: 4 } }] })).toBeGreaterThan(inset({}) + 3);
      expect(inset({ effects: [{ type: 'bevel' }] })).toBe(inset({}));
      expect(inset({ bloat: 3 })).toBe(inset({}));
    });
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

  it('draws the shape\'s focus path while it holds focus', () => {
    const { container } = render(<Badge shape="notched" onClick={() => {}}>x</Badge>);
    expect(container.querySelector('.badge-focus')).toBeNull();
    fireEvent.focus(container.firstElementChild as HTMLButtonElement);
    expect(container.querySelector('.badge-focus')).not.toBeNull();
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

const INTERACTIVE = 'button, a, [role="button"], [tabindex]';

/** Interactive elements that sit inside another one, which HTML forbids for a button or a link. */
function nestedInteractive(container: HTMLElement): Element[] {
  return [...container.querySelectorAll(INTERACTIVE)].filter((el) => el.parentElement?.closest(INTERACTIVE));
}

describe('Badge removable with an action of its own', () => {
  const cases = {
    'onClick': <Badge onClick={() => {}} onRemove={() => {}}>x</Badge>,
    'href': <Badge href="/x" onRemove={() => {}}>x</Badge>,
    'as="button"': <Badge as="button" onRemove={() => {}}>x</Badge>,
    'a tooltip': <Badge tooltip="tip" onRemove={() => {}}>x</Badge>,
    'onClick and a tooltip': <Badge tooltip="tip" onClick={() => {}} onRemove={() => {}}>x</Badge>,
  };

  for (const [name, badge] of Object.entries(cases)) {
    it(`nests no interactive element in another with ${name}`, () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { container } = render(badge);
      expect(nestedInteractive(container)).toEqual([]);
      expect(container.firstElementChild?.tagName).toBe('SPAN');
      expect(container.firstElementChild?.matches(INTERACTIVE)).toBe(false);
      expect(errors).not.toHaveBeenCalled();
      errors.mockRestore();
    });
  }

  it('keeps the box, the data attributes, and the ref on the root', () => {
    const ref = createRef<HTMLElement>();
    const { container } = render(
      <Badge ref={ref} id="b1" grade="warn" size="md" shape="notched" onClick={() => {}} onRemove={() => {}}>x</Badge>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(ref.current).toBe(root);
    expect(root.id).toBe('b1');
    expect(root.dataset.grade).toBe('warn');
    expect(root.dataset.size).toBe('md');
    expect(root.dataset.shape).toBe('notched');
    expect(root.style.getPropertyValue('--badge-inset-left')).toBe('4px');
  });

  it('fires onClick from a click, Enter, and Space on the click target', () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    render(<Badge aria-label="Filter by tag" onClick={onClick} onRemove={onRemove}>tag</Badge>);
    const target = screen.getByRole('button', { name: 'Filter by tag' });
    expect(target.tabIndex).toBe(0);
    target.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(target, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(target, { key: ' ' });
    fireEvent.keyUp(target, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(3);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('fires only onRemove from the remove control, by click', () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    render(<Badge onClick={onClick} onRemove={onRemove}>tag</Badge>);
    const remove = screen.getByRole('button', { name: 'Remove' });
    remove.click();
    fireEvent.keyDown(remove, { key: 'Enter' });
    fireEvent.keyDown(remove, { key: ' ' });
    fireEvent.keyUp(remove, { key: ' ' });
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('links the label and leaves the remove control beside the link', () => {
    const onRemove = vi.fn();
    render(<Badge href="/tags/x" onRemove={onRemove}>tag</Badge>);
    const link = screen.getByRole('link', { name: 'tag' });
    expect(link.getAttribute('href')).toBe('/tags/x');
    const remove = screen.getByRole('button', { name: 'Remove' });
    expect(link.contains(remove)).toBe(false);
    expect(remove.parentElement).toBe(link.parentElement);
  });

  it('marks the root focused while the click target holds focus, not the remove control', () => {
    const { container } = render(<Badge shape="notched" onClick={() => {}} onRemove={() => {}}>tag</Badge>);
    const root = container.firstElementChild as HTMLElement;
    const target = screen.getByRole('button', { name: 'tag' });
    fireEvent.focus(target);
    expect(root.getAttribute('data-focused')).toBe('true');
    expect(container.querySelector('.badge-focus')).not.toBeNull();
    fireEvent.blur(target);
    fireEvent.focus(screen.getByRole('button', { name: 'Remove' }));
    expect(root.hasAttribute('data-focused')).toBe(false);
  });

  it('describes the click target with the tooltip', () => {
    render(<Badge tooltip="Filter by tag" onClick={() => {}} onRemove={() => {}}>tag</Badge>);
    const target = screen.getByRole('button', { name: 'tag' });
    keyboardFocus(target);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Filter by tag');
    expect(target.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('keeps the remove control reachable beside a tooltip-only label', () => {
    render(<Badge tooltip="Matched by a predicate" onRemove={() => {}}>?</Badge>);
    const label = screen.getByRole('img', { name: '?' });
    expect(label.tabIndex).toBe(0);
    expect(label.contains(screen.getByRole('button', { name: 'Remove' }))).toBe(false);
  });
});

// jsdom resolves no var() and the CSS-module proxy answers any key, so these
// read the stylesheet as text — a proxy for the rules existing at all.
describe('Badge padded through style', () => {
  // A proxy for the click target: the stylesheet pads the root and stretches a removable badge's
  // label from the same --badge-pad-* properties, and jsdom lays neither out.
  it('pads through the properties the click target reads, not through padding itself', () => {
    const { container } = render(
      <Badge onClick={() => {}} onRemove={() => {}} style={{ padding: '2px 12px', paddingLeft: 20 }}>x</Badge>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.padding).toBe('');
    expect(el.style.paddingLeft).toBe('');
    expect(el.style.getPropertyValue('--badge-pad-top')).toBe('2px');
    expect(el.style.getPropertyValue('--badge-pad-right')).toBe('12px');
    expect(el.style.getPropertyValue('--badge-pad-left')).toBe('20px');
  });

  it('lets style win over the padding prop', () => {
    const { container } = render(<Badge padding={4} style={{ paddingRight: 9 }}>x</Badge>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.getPropertyValue('--badge-pad-left')).toBe('4px');
    expect(el.style.getPropertyValue('--badge-pad-right')).toBe('9px');
  });
});

describe('Badge stylesheet', () => {
  const css = readFileSync(resolve(__dirname, 'Badge.module.css'), 'utf8');

  it('paints a grade from its inherited --wzl-grade', () => {
    const { container } = render(<Badge grade="success">ok</Badge>);
    expect(container.firstElementChild?.getAttribute('data-grade')).toBe('success');
    expect(css).toMatch(/\.badge\[data-grade\]\s*\{\s*--badge-status-edge: var\(--wzl-grade\);/);
    expect(css).toMatch(/--badge-status-edge: var\(--wzl-emphasis-fg, var\(--wzl-border\)\);/);
  });

  it('paints a tint or a stance accent over the grade and emphasis, and keys nothing off data-tone', () => {
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
