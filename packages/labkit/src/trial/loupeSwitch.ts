import { createContext, useCallback, useMemo, useState } from 'react';
import type { LoupeBindings } from './TrialChrome';

/**
 * A trial's loupe switch, as a lens mounted inside the trial finds it. The
 * trial offers its toolbar toggles while at least one lens has called `mount`,
 * and every lens reads `on` as whether it is turned on.
 */
export interface LoupeSwitch {
  on: boolean;
  /** Reports a lens mounted; the returned function reports it gone. */
  mount: () => () => void;
  /** Whether the eyedropper is on: a click on the stage picks the color under it. */
  dropper: boolean;
  /** Report a picked color, from the eyedropper or a click inside a lens. The
   *  trial's readout shows it, and its Copy copies it. */
  pick: (hex: string) => void;
}

/** The loupe switch of the trial around the caller, or `null` outside one. */
export const LoupeSwitchContext = createContext<LoupeSwitch | null>(null);

/** A trial's loupe switch, and the toolbar's bindings for it while any lens is mounted. */
export function useLoupeSwitch(): { loupeSwitch: LoupeSwitch; loupeBindings?: LoupeBindings } {
  const [on, setOn] = useState(false);
  const [dropper, setDropper] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [lenses, setLenses] = useState(0);
  const mount = useCallback(() => {
    setLenses((n) => n + 1);
    return () => setLenses((n) => n - 1);
  }, []);
  const loupeSwitch = useMemo(() => ({ on, mount, dropper, pick: setPicked }), [on, mount, dropper]);
  if (lenses === 0) return { loupeSwitch };
  return {
    loupeSwitch,
    loupeBindings: {
      on,
      toggle: () => setOn((v) => !v),
      dropper,
      toggleDropper: () => setDropper((v) => !v),
      picked,
    },
  };
}
