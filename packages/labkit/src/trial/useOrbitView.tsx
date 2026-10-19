import { isDev } from '@weasel-js/react';
import { createContext, type ReactNode, useContext, useEffect, useMemo } from 'react';
import type { Instrument } from '../instrument/types';
import { type TrialOrbit, TrialOrbitContext } from './useTrialOrbit';

/** Tells the trial around it that a 3D view is drawn there. */
const OrbitViewContext = createContext<(() => void) | null>(null);

const INERT: TrialOrbit = {
  camera: null,
  setCamera: () => {},
  home: () => {},
  viewportRef: () => {},
};

/**
 * What a 3D view inside a trial draws through: the trial's orbit camera, with
 * `viewportRef` for the element the scene is drawn in, so the camera's
 * gestures land there. Call it from whatever renders the scene — three.js, raw
 * WebGL, a surface tile. In a trial whose instrument declares no `orbit` the
 * camera is `null` and nothing moves it, and in development the trial warns:
 * declare `orbit`, or `orbit: { fixed: true }` for a camera that holds still.
 */
export function useOrbitView(): TrialOrbit {
  const declare = useContext(OrbitViewContext);
  useEffect(() => declare?.(), [declare]);
  return useContext(TrialOrbitContext) ?? INERT;
}

const warned = new WeakSet<Instrument>();

/** Provides a trial's orbit to `useTrialOrbit` and `useOrbitView`, and warns
 *  of a 3D view drawn with no orbit to move it — once per instrument. */
export function TrialOrbitProvider({
  orbit,
  instrument,
  children,
}: {
  orbit: TrialOrbit | null;
  instrument: Instrument;
  children: ReactNode;
}) {
  const hasOrbit = orbit !== null;
  const declare = useMemo(
    () =>
      hasOrbit
        ? null
        : () => {
            if (!isDev() || warned.has(instrument)) return;
            warned.add(instrument);
            console.warn(
              `[labkit] instrument "${instrument.name}" draws a 3D view (useOrbitView), but it declares no \`orbit\`, so nothing can turn, dolly, pan, or home its camera. Declare \`orbit: {}\` for the trial's orbit camera, or \`orbit: { fixed: true }\` for one that holds still.`,
            );
          },
    [hasOrbit, instrument],
  );
  return (
    <TrialOrbitContext.Provider value={orbit}>
      <OrbitViewContext.Provider value={declare}>{children}</OrbitViewContext.Provider>
    </TrialOrbitContext.Provider>
  );
}
