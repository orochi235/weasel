import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PropertyField } from './PropertyField';

const settledOnly = (): void => {};

function slider(value: number) {
  return (
    <PropertyField kind="number" control="slider" label="Width" value={value} min={0} max={10} onInput={settledOnly} onChange={() => {}} />
  );
}

// A browser fires no `change` for a drag that ends where it began, so nothing
// tells the track the gesture is over. jsdom fires none unless asked, which is
// the same silence.
it('shows a value set from outside after a drag that ended where it began', () => {
  const { rerender } = render(slider(5));
  const track = screen.getByRole('slider') as HTMLInputElement;
  fireEvent.input(track, { target: { value: '8' } });
  expect(track.value).toBe('8');
  fireEvent.input(track, { target: { value: '5' } });
  rerender(slider(3));
  expect(track.value).toBe('3');
});
