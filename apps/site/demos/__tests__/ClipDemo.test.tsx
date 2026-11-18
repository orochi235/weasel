import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ClipDemo } from '../ClipDemo';

afterEach(cleanup);

describe('ClipDemo', () => {
  it('refuses a clip whose event its binder does not know', () => {
    render(<ClipDemo />);
    const code = screen.getByLabelText('Clip JSON') as HTMLTextAreaElement;
    fireEvent.change(code, { target: { value: code.value.replaceAll('"name": "log"', '"name": "note"') } });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'load the JSON' })); });
    expect(screen.getByText(/no event named "note"/)).toBeTruthy();
  });
});
