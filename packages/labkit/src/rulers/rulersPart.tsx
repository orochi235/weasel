import type { SurfaceContribution } from '@weasel-js/core';
import { type ReactNode, useMemo } from 'react';
import type { Instrument, ViewTransform2D } from '../instrument/types';
import { DEFAULT_VIEW } from '../state/view';
import { cameraOf } from '../trial/homeView';
import { CameraRulers } from './CameraRulers';
import type { TrialGuides } from './trialGuides';
import { useCameraRulers } from './useTrialRulers';

/** What a trial hands its 2D camera for the rulers: the contribution its dispatcher installs, and what it draws. */
export interface TrialRulersPart {
  contributions: readonly SurfaceContribution[];
  chrome: ReactNode;
}

/** The rulers on `instrument`'s `canvas` or `stage`, where it offers them and the trial is there to keep guides. */
export function useTrialRulersPart(
  instrument: Instrument,
  guides: TrialGuides | null,
  view: ViewTransform2D | null,
): TrialRulersPart | null {
  const camera = cameraOf(instrument);
  const flat = camera?.kind === 'canvas' || camera?.kind === 'stage' ? camera : null;
  const yAxis =
    flat?.kind === 'canvas' && flat.capability.worldSpec?.yAxis === 'up' ? 'up' : 'down';
  const made = useCameraRulers(flat?.capability.rulers, yAxis, guides);
  const contributions = useMemo(() => (made ? [made.contribution] : null), [made]);
  if (!made || !contributions || !guides) return null;
  return {
    contributions,
    chrome: (
      <CameraRulers
        rulers={made.rulers}
        view={view ?? DEFAULT_VIEW}
        shown={guides.shown}
        getGuides={guides.getGuides}
        subscribe={guides.subscribe}
      />
    ),
  };
}
