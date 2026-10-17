import type { Camera3d } from '@weasel-js/kernel3d';
import { createContext, useContext } from 'react';

/** An orbit trial's camera, for anything in the trial that reads or moves it. */
export interface TrialOrbit {
  /** The camera now; `null` until a camera that opens by its viewport's size
   *  has been measured. */
  camera: Camera3d | null;
  /** Replaces the camera, inside the instrument's limits. */
  setCamera: (camera: Camera3d) => void;
  /** Returns the camera to where it opened. */
  home: () => void;
}

export const TrialOrbitContext = createContext<TrialOrbit | null>(null);

/** The orbit camera of the trial around the caller — its instrument's DOM, a
 *  sidebar section, an overlay — or `null` in a trial whose instrument
 *  declares no `orbit`. Re-renders on every change, mid-drag included. */
export function useTrialOrbit(): TrialOrbit | null {
  return useContext(TrialOrbitContext);
}
