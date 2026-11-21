import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ReorderHandle } from './ReorderHandle';

afterEach(() => { vi.useRealTimers(); });

it('does not pull focus back on a later render after a nudge that never re-rendered the handle', () => {
  vi.useFakeTimers();
  const { rerender } = render(<><ReorderHandle label="Row" onNudge={() => true} /><input aria-label="Elsewhere" /></>);
  const handle = screen.getByRole('button');
  handle.focus();
  fireEvent.keyDown(handle, { key: 'ArrowDown', altKey: true });
  act(() => { vi.runAllTimers(); });
  const elsewhere = screen.getByLabelText('Elsewhere');
  elsewhere.focus();
  rerender(<><ReorderHandle label="Row" onNudge={() => true} pressed /><input aria-label="Elsewhere" /></>);
  expect(document.activeElement).toBe(elsewhere);
});

it('gives focus back to a handle whose row moved without rendering it', () => {
  vi.useFakeTimers();
  render(<ReorderHandle label="Row" onNudge={() => true} />);
  const handle = screen.getByRole('button');
  handle.focus();
  fireEvent.keyDown(handle, { key: 'ArrowDown', altKey: true });
  handle.blur();
  act(() => { vi.runAllTimers(); });
  expect(document.activeElement).toBe(handle);
});

it('keeps focus on the handle when the move re-renders it', () => {
  function Host({ n }: { n: number }) {
    return <ReorderHandle label={`Row ${n}`} onNudge={() => true} />;
  }
  const { rerender } = render(<Host n={0} />);
  const handle = screen.getByRole('button');
  handle.focus();
  fireEvent.keyDown(handle, { key: 'ArrowDown', altKey: true });
  handle.blur();
  rerender(<Host n={1} />);
  expect(document.activeElement).toBe(handle);
});
