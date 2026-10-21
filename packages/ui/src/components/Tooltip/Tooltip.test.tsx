import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Focusable } from './Focusable';
import { TooltipTrigger, Tooltip } from './Tooltip';

function Subject(props: { placement?: 'top' | 'bottom' | 'left' | 'right'; children?: ReactNode }) {
  return (
    <TooltipTrigger>
      <Focusable>
        <button type="button">Save</button>
      </Focusable>
      <Tooltip placement={props.placement}>{props.children ?? 'Save the document'}</Tooltip>
    </TooltipTrigger>
  );
}

/** Enter keyboard modality, then focus — RAC only opens tooltips on focus-visible. */
function keyboardFocus(el: HTMLElement) {
  fireEvent.keyDown(document.body, { key: 'Tab' });
  act(() => el.focus());
}

describe('Tooltip', () => {
  it('shows on keyboard focus and links via aria-describedby', () => {
    render(<Subject />);
    const btn = screen.getByRole('button');
    expect(screen.queryByRole('tooltip')).toBeNull();
    keyboardFocus(btn);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Save the document');
    expect(btn.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('hides on blur', () => {
    render(<Subject />);
    const btn = screen.getByRole('button');
    keyboardFocus(btn);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    act(() => btn.blur());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('renders the arrow svg', () => {
    render(<Subject />);
    keyboardFocus(screen.getByRole('button'));
    const tip = screen.getByRole('tooltip');
    expect(tip.querySelector('svg')).toBeTruthy();
  });

  it('applies the requested placement', () => {
    render(<Subject placement="right" />);
    keyboardFocus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip').getAttribute('data-placement')).toBe('right');
  });

  it('draws a string child as inline markdown', () => {
    render(<Subject>{'Sets `fill` on **every** stop, see [the docs](https://example.com).'}</Subject>);
    keyboardFocus(screen.getByRole('button'));
    const tip = screen.getByRole('tooltip');
    expect(tip.querySelector('code')?.textContent).toBe('fill');
    expect(tip.querySelector('strong')?.textContent).toBe('every');
    expect(tip.querySelector('a')).toBeNull();
    expect(tip.textContent).toBe('Sets fill on every stop, see the docs.');
  });

  it('draws each string among several children as inline markdown, and leaves an element alone', () => {
    render(
      <Subject>
        {'Reads `auto`'}
        <span data-testid="kept">`raw`</span>
      </Subject>,
    );
    keyboardFocus(screen.getByRole('button'));
    const tip = screen.getByRole('tooltip');
    expect(tip.querySelector('code')?.textContent).toBe('auto');
    expect(screen.getByTestId('kept').textContent).toBe('`raw`');
  });
});
