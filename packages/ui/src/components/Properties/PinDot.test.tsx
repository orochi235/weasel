import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PinDot } from './PinDot';

describe('PinDot', () => {
  it('reports its state through aria-pressed', () => {
    const { rerender } = render(<PinDot auto={false} label="Gap" onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    rerender(<PinDot auto label="Gap" onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('names itself after the row, so a screen reader says which field', () => {
    render(<PinDot auto={false} label="Gap" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Gap/ })).toBeInTheDocument();
  });

  it('toggles on click and on Enter', async () => {
    const onChange = vi.fn();
    render(<PinDot auto={false} label="Gap" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith(true);
    onChange.mockClear();
    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('suppresses the default that would actuate the row label it sits inside', () => {
    // A PROXY, and say so: in jsdom a <label> does not retarget a click the way
    // a browser does, so "the control did not actuate" cannot fail here. What
    // is assertable is that the default was prevented.
    render(<PinDot auto={false} label="Gap" onChange={() => {}} />);
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByRole('button').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
