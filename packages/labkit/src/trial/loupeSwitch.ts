import { createContext } from 'react';

/**
 * A trial's loupe switch, as a lens mounted inside the trial finds it. The
 * trial offers its toolbar toggle while at least one lens has called `mount`,
 * and every lens reads `on` as whether it is turned on.
 */
export interface LoupeSwitch {
  on: boolean;
  /** Reports a lens mounted; the returned function reports it gone. */
  mount: () => () => void;
}

/** The loupe switch of the trial around the caller, or `null` outside one. */
export const LoupeSwitchContext = createContext<LoupeSwitch | null>(null);
