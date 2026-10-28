import type { ClockHandle, ClockRegistry } from '@weasel-js/clock';
import { createContext, type MutableRefObject } from 'react';

/** The registry a lab keeps its clocks in. */
export const ClockRegistryContext = createContext<ClockRegistry | null>(null);

/** Stands in a trial's {@link TrialClockContext} while the clock it declares
 *  is not made yet, so it resolves to none rather than to another trial's. */
export const PENDING_CLOCK: unique symbol = Symbol('pending trial clock');

/** The clock of the trial a component renders inside, when it has one. */
export const TrialClockContext = createContext<ClockHandle | typeof PENDING_CLOCK | null>(null);

/** Where the trial around a component keeps its outermost element, which the
 *  trial's clock registers as the element showing it. */
export const TrialRootContext = createContext<MutableRefObject<HTMLElement | null> | null>(null);
