import { act, fireEvent, screen, within } from '@testing-library/react';

/** A select row's trigger, which opens its listbox. Its accessible name is the
 *  value then the label ("A Mode"), and a standalone help's ⓘ is "About <label>",
 *  so the label alone matches both. */
export const trigger = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`(?<!About )${label}`) });

/** Opens a select row and chooses an option, the way a person does. */
export function pick(label: string, option: string) {
  act(() => {
    fireEvent.click(trigger(label));
  });
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
}
