import { TrialIdContext } from '@weasel-js/labkit';
import { type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { Layout } from '../../protocol/messages';
import { useCssOverrides } from '../cssVars/overrides';
import { createCaptureTrials, type LoupeCapture, LoupeCaptureContext, type Revision, type TrialInputs } from './captureContext';
import { createLiveLenses, LiveLensesContext } from './liveLenses';

/** Props for `CaptureInputs`. */
export interface CaptureInputsProps {
  entry: TrialInputs['entry'];
  layout: Layout;
  config: unknown;
  state: unknown;
}

/** Publishes the trial it renders in to the workshop's Pixels lenses: what a capture of its story is made from. */
export function CaptureInputs({ entry, layout, config, state }: CaptureInputsProps) {
  const capture = useContext(LoupeCaptureContext);
  const trialId = useContext(TrialIdContext);
  const [overrides] = useCssOverrides();
  useEffect(
    () => (capture && trialId ? capture.trials.publish(trialId, { entry, layout, config, state, overrides }) : undefined),
    [capture, trialId, entry, layout, config, state, overrides],
  );
  return null;
}

/** Props for `LoupeProvider`. */
export interface LoupeProviderProps {
  /** The dev server's base; absent, lenses offer no Pixels source. */
  captureBase?: string | undefined;
  /** Bumped on every story edit. */
  revision?: Revision | undefined;
  children: ReactNode;
}

const STILL: Revision = { get: () => 0, subscribe: () => () => {} };

/** What the workshop's lenses read from its trials: the Live requests each trial answers, and each trial's inputs. */
export function LoupeProvider({ captureBase, revision = STILL, children }: LoupeProviderProps) {
  const [lenses] = useState(createLiveLenses);
  const [trials] = useState(createCaptureTrials);
  const capture = useMemo<LoupeCapture | null>(
    () => (captureBase === undefined ? null : { base: captureBase, trials, revision }),
    [captureBase, trials, revision],
  );
  return (
    <LiveLensesContext.Provider value={lenses}>
      <LoupeCaptureContext.Provider value={capture}>{children}</LoupeCaptureContext.Provider>
    </LiveLensesContext.Provider>
  );
}
