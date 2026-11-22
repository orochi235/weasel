import { act, fireEvent, screen, within } from '@testing-library/react';

/** The text of the label a trigger names itself after last, when that is another element. */
function labelOf(button: HTMLElement): string | undefined {
  const last = button.getAttribute('aria-labelledby')?.trim().split(/\s+/).at(-1);
  const el = last ? document.getElementById(last) : null;
  return el && el !== button ? (el.textContent?.trim() ?? '') : undefined;
}

/** A select row's trigger, which opens its listbox. Its accessible name is the
 *  value then the label ("A Mode"), and a standalone help's ⓘ is "About <label>",
 *  so the name must end in the label and not be the help's. Where the trigger
 *  names its label element, that element must read `label` whole, so "Mode" is
 *  never a "Blend Mode" row. */
export function trigger(label: string): HTMLElement {
  const name = new RegExp(`^(?!About )(?:.*\\s)?${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  const found = screen.queryAllByRole('button', { name }).filter((b) => (labelOf(b) ?? label) === label);
  if (found.length !== 1) throw new Error(`trigger: ${found.length} select rows labeled "${label}"`);
  return found[0]!;
}

/** Opens a select row and chooses an option, the way a person does. */
export function pick(label: string, option: string) {
  act(() => {
    fireEvent.click(trigger(label));
  });
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
}
