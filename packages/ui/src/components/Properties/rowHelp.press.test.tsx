import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FOCUS_DELAY, useRowHelp } from './rowHelp';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Row() {
  const cue = useRef<HTMLSpanElement>(null);
  const help = useRowHelp(cue, '.row');
  return (
    <div className="row">
      <span><span ref={cue} /></span>
      <input aria-label="First" />
      <input aria-label="Second" />
      {help.open && <span role="note">help</span>}
    </div>
  );
}

const settle = () => act(() => { vi.advanceTimersByTime(FOCUS_DELAY); });

describe('useRowHelp under a pointer', () => {
  it('leaves the help shut for focus a press in the row brought', () => {
    vi.useFakeTimers();
    render(<Row />);
    const first = screen.getByRole('textbox', { name: 'First' });
    fireEvent.pointerDown(first, { pointerId: 1, buttons: 1 });
    fireEvent.focusIn(first);
    settle();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('opens for keyboard focus after a press released outside the row', () => {
    vi.useFakeTimers();
    render(<Row />);
    const first = screen.getByRole('textbox', { name: 'First' });
    fireEvent.pointerDown(first, { pointerId: 1, buttons: 1 });
    fireEvent.focusIn(first);
    fireEvent.pointerUp(document.body, { pointerId: 1 });
    fireEvent.focusIn(screen.getByRole('textbox', { name: 'Second' }));
    settle();
    expect(screen.queryByRole('note')).not.toBeNull();
  });
});
