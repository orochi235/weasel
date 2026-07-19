import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Focusable } from 'react-aria-components';
import { TooltipTrigger, Tooltip } from './Tooltip';

function Subject(props: { placement?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <TooltipTrigger>
      <Focusable>
        <button type="button">Save</button>
      </Focusable>
      <Tooltip placement={props.placement}>Save the document</Tooltip>
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
});
