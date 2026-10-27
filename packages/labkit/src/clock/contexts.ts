import type { ClockHandle, ClockRegistry } from '@weasel-js/clock';
import { createContext } from 'react';

/** The registry a lab keeps its clocks in. */
export const ClockRegistryContext = createContext<ClockRegistry | null>(null);

/** The clock of the trial a component renders inside, when it has one. */
export const TrialClockContext = createContext<ClockHandle | null>(null);
