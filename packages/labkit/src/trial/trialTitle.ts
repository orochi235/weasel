import { createContext, useContext } from 'react';

/** The title the trial a component is mounted in reads, as its title bar shows it. */
export const TrialTitleContext = createContext<string | null>(null);

/** The enclosing trial's title, or null outside a trial. */
export function useTrialTitle(): string | null {
  return useContext(TrialTitleContext);
}
