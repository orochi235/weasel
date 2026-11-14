import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Disabled, ReadOnly } from '../Disabled';
import { InlineRange } from './InlineRange';

const fillOf = (el: HTMLElement): string | null =>
  el.style.getPropertyValue('--slider-fill') || null;

describe('InlineRange', () => {
  it('reports the value as a percentage of its range', () => {
    render(<InlineRange aria-label="Width" min={0} max={20} value={5} onChange={() => {}} />);
    expect(fillOf(screen.getByLabelText('Width'))).toBe('25%');
  });

  it('measures from `min`, not from zero', () => {
    render(<InlineRange aria-label="Width" min={10} max={20} value={15} onChange={() => {}} />);
    expect(fillOf(screen.getByLabelText('Width'))).toBe('50%');
  });

  it('clamps a value outside the range instead of overflowing the track', () => {
    render(<InlineRange aria-label="Over" min={0} max={20} value={50} onChange={() => {}} />);
    expect(fillOf(screen.getByLabelText('Over'))).toBe('100%');
  });

  // A degenerate range divides by zero, which would render `NaN%` and drop the
  // background entirely rather than failing loudly.
  it('survives a zero-width range', () => {
    render(<InlineRange aria-label="Flat" min={5} max={5} value={5} onChange={() => {}} />);
    expect(fillOf(screen.getByLabelText('Flat'))).toBe('0%');
  });

  it('forwards input events to the caller', () => {
    const seen: string[] = [];
    render(
      <InlineRange
        aria-label="Opacity"
        min={0}
        max={100}
        value={40}
        onChange={(e) => seen.push((e.target as HTMLInputElement).value)}
      />,
    );
    fireEvent.change(screen.getByLabelText('Opacity'), { target: { value: '70' } });
    expect(seen).toEqual(['70']);
  });
});

// A held range hands back none of its handlers, so these test the handlers, never jsdom's own input on a disabled element.
describe('InlineRange held', () => {
  const renderHeld = (wrap: (n: ReactNode) => ReactNode) => {
    const handlers = { onChange: vi.fn(), onInput: vi.fn(), onKeyDown: vi.fn(), onPointerDown: vi.fn() };
    render(<>{wrap(<InlineRange aria-label="Width" min={0} max={20} value={5} {...handlers} />)}</>);
    const input = screen.getByLabelText('Width');
    fireEvent.pointerDown(input);
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    fireEvent.change(input, { target: { value: '9' } });
    for (const fn of Object.values(handlers)) expect(fn).not.toHaveBeenCalled();
    return input;
  };

  it('disabled with no reason is natively disabled', () => {
    expect(renderHeld((n) => <Disabled>{n}</Disabled>)).toBeDisabled();
  });

  it('disabled for a reason stays focusable, keeps its thumb still, and says why', () => {
    const input = renderHeld((n) => <Disabled reason="Locked">{n}</Disabled>);
    expect(input).not.toBeDisabled();
    expect(input.getAttribute('aria-disabled')).toBe('true');
    expect(input).toHaveAccessibleDescription('Locked');
    const key = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    input.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
  });

  it('read-only holds it, focusable', () => {
    const input = renderHeld((n) => <ReadOnly>{n}</ReadOnly>);
    expect(input).not.toBeDisabled();
    expect(input.getAttribute('aria-readonly')).toBe('true');
  });

  it('nested scopes hold it, the nearest reason told', () => {
    expect(renderHeld((n) => <Disabled reason="Outer"><Disabled reason="Inner">{n}</Disabled></Disabled>)).toHaveAccessibleDescription('Inner');
  });
});

