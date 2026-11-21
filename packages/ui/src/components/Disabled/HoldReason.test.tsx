import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useHoldReason } from './HoldReason';

function Held({ as }: { as: 'input' | 'button' }) {
  const reason = useHoldReason('Locked');
  return reason.wrap(as === 'input' ? <input aria-label="Field" /> : <button type="button">Field</button>);
}

describe('useHoldReason', () => {
  it('shows its tooltip on a control that replaced the one it first followed', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<Held as="input" />);
      rerender(<Held as="button" />);
      act(() => { fireEvent.focusIn(screen.getByRole('button', { name: 'Field' })); });
      expect(screen.getByRole('tooltip')).toHaveTextContent('Locked');
    } finally {
      vi.useRealTimers();
    }
  });
});
