import { createContext, useCallback, useMemo, useState } from 'react';
import type { LoupeBindings } from './TrialChrome';

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

/** A trial's loupe switch, and the toolbar's bindings for it while any lens is mounted. */
export function useLoupeSwitch(): { loupeSwitch: LoupeSwitch; loupeBindings?: LoupeBindings } {
  const [on, setOn] = useState(false);
  const [lenses, setLenses] = useState(0);
  const mount = useCallback(() => {
    setLenses((n) => n + 1);
    return () => setLenses((n) => n - 1);
  }, []);
  const loupeSwitch = useMemo(() => ({ on, mount }), [on, mount]);
  if (lenses === 0) return { loupeSwitch };
  return { loupeSwitch, loupeBindings: { on, toggle: () => setOn((v) => !v) } };
}
