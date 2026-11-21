import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PropertyField } from './PropertyField';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('a text field that waits before sending what is typed', () => {
  it('sends the text it began from before onCancel when Escape drops the draft', () => {
    const calls: string[] = [];
    render(
      <PropertyField
        kind="string"
        label="Title"
        value="x"
        inputWaitMs={300}
        onInput={(v) => calls.push(`input ${v}`)}
        onCancel={() => calls.push('cancel')}
        onChange={(v) => calls.push(`change ${v}`)}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Title' });
    input.focus();
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(calls).toEqual(['input x', 'cancel']);
  });
});
