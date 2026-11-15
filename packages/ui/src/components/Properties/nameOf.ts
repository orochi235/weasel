import type { ReactNode } from 'react';
import { usePropertyRow } from './rowScope';

// A row's <label> text can also hold the help's ⓘ and any readout, so a
// control takes its name from the string label, not from the <label> that
// `for` points at it.
export function nameOf(label: ReactNode): string | undefined {
  return typeof label === 'string' ? label : undefined;
}

/** A control's name as text, for a control that draws it or builds on it — a toggle segment's words, a menu
 *  button's `name: value`, an opacity slider's `name opacity`: its own `name`, else its row's string label. Any
 *  other control is named by the row's label element, through `useFieldControl`. */
export function useNameText(name: string | undefined): string | undefined {
  const row = usePropertyRow();
  return name ?? nameOf(row?.label);
}
