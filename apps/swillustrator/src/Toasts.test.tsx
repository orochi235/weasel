import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toasts } from './Toasts';

describe('Toasts', () => {
  it('renders nothing for an empty list', () => {
    const { container } = render(<Toasts toasts={[]} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one entry per toast with title + messages', () => {
    render(
      <Toasts
        toasts={[{ id: 1, title: 'Warnings', messages: ['a', 'b'] }]}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText('Warnings')).toBeTruthy();
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
  });

  it('calls onDismiss when the close button is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <Toasts
        toasts={[{ id: 7, title: 'X', messages: [] }]}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledWith(7);
  });

  it('auto-dismisses after ttlMs', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toasts
        toasts={[{ id: 3, title: 'X', messages: [] }]}
        onDismiss={onDismiss}
        ttlMs={1000}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(onDismiss).toHaveBeenCalledWith(3);
    vi.useRealTimers();
  });
});
