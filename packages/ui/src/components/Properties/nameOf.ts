import type { ReactNode } from 'react';

// A row's <label> text can also hold the help's ⓘ and any readout, so a
// control takes its name from the string label, not from the <label> that
// `for` points at it.
export function nameOf(label: ReactNode): string | undefined {
  return typeof label === 'string' ? label : undefined;
}
