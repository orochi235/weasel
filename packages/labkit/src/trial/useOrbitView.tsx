import { isDev } from '@weasel-js/react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type { Instrument } from '../instrument/types';
import { type TrialOrbit, TrialOrbitContext } from './useTrialOrbit';
import { install3dWatch, watch3d } from './watch3d';

/** Tells the trial around it that a 3D view is drawn there, and how. */
const OrbitViewContext = createContext<((how: string) => void) | null>(null);

/** How a trial with no camera draws 3D, or `null` while it draws none — what
 *  the title bar's dev-time mark reads. */
export const CameraMissingContext = createContext<string | null>(null);

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
 * camera is `null` and nothing moves it, and in development the trial warns.
 */
export function useOrbitView(): TrialOrbit {
  const declare = useContext(OrbitViewContext);
  useEffect(() => declare?.('useOrbitView'), [declare]);
  return useContext(TrialOrbitContext) ?? INERT;
}

const warned = new WeakSet<Instrument>();

function warnOfNoCamera(instrument: Instrument, how: string): void {
  if (warned.has(instrument)) return;
  warned.add(instrument);
  console.warn(
    `[labkit] instrument "${instrument.name}" draws a 3D view (${how}), but declares no \`orbit\`, so the trial has no camera: nothing labkit owns turns, dollies, pans, or homes it, and Clone, Reset, and the zoom controls pass it by. Declare \`orbit: {}\` for the trial's orbit camera, \`orbit: { fixed: true }\` for one that holds still, or \`orbit: false\` if the instrument keeps a camera of its own.`,
  );
}

/**
 * Provides a trial's orbit to `useTrialOrbit` and `useOrbitView`. In
 * development it also watches for a 3D view drawn in a trial whose instrument
 * leaves `orbit` undeclared — through `useOrbitView`, a three.js renderer in
 * its DOM, or WebGL depth testing on a canvas there — and warns once per
 * instrument and marks the title bar.
 */
export function TrialOrbitProvider({
  orbit,
  instrument,
  trialId,
  children,
}: {
  orbit: TrialOrbit | null;
  instrument: Instrument;
  trialId: string;
  children: ReactNode;
}) {
  const undeclared = instrument.orbit === undefined && isDev();
  // Ahead of the instrument's effects, which is where a renderer is built.
  if (undeclared) install3dWatch();
  const [missing, setMissing] = useState<string | null>(null);
  const declare = useCallback(
    (how: string) => {
      if (!undeclared) return;
      warnOfNoCamera(instrument, how);
      setMissing((was) => was ?? how);
    },
    [undeclared, instrument],
  );
  useEffect(
    () => (undeclared ? watch3d(trialId, declare) : undefined),
    [undeclared, trialId, declare],
  );
  return (
    <TrialOrbitContext.Provider value={orbit}>
      <OrbitViewContext.Provider value={declare}>
        <CameraMissingContext.Provider value={undeclared ? missing : null}>
          {children}
        </CameraMissingContext.Provider>
      </OrbitViewContext.Provider>
    </TrialOrbitContext.Provider>
  );
}
