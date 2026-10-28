import type { ClockHandle, ClockRegistry } from '@weasel-js/clock';
import { createContext, type MutableRefObject } from 'react';

/** The registry a lab keeps its clocks in. */
export const ClockRegistryContext = createContext<ClockRegistry | null>(null);

/** The clock of the trial a component renders inside, when it has one. */
export const TrialClockContext = createContext<ClockHandle | null>(null);

/** Where the trial around a component keeps its outermost element, which the
 *  trial's clock registers as the element showing it. */
export const TrialRootContext = createContext<MutableRefObject<HTMLElement | null> | null>(null);
