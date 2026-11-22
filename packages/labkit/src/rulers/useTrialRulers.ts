import type { SurfaceContribution } from '@weasel-js/core';
import { createRulers, type Rulers, type RulersYAxis } from '@weasel-js/guides';
import { PIXELS, type UnitScope } from '@weasel-js/quantity';
import { useEffect, useMemo } from 'react';
import { trialRulersEntry } from './rulersEntry';
import type { TrialGuides } from './trialGuides';
import type { RulersOption } from './types';

/** What a ruler reads in when its instrument names no unit. */
export const CSS_PX: UnitScope = { system: PIXELS };

/**
 * Rulers for `option`, writing `guides`' guides and offered to its trial while mounted: `null` with no option or no
 * trial. `yAxis` is which way the instrument's world runs against the canvas world the rulers read.
 */
export function useOfferedRulers(
  option: RulersOption | undefined,
  yAxis: RulersYAxis,
  guides: TrialGuides | null,
): Rulers | null {
  const on = option !== undefined && option !== false;
  const opts = typeof option === 'object' ? option : null;
  const unit = opts?.unit;
  const lengths = opts?.lengths;
  const store = guides?.store;
  const rulers = useMemo(
    () =>
      on && store
        ? createRulers({
            id: 'lk-rulers',
            guides: store,
            root: unit ?? CSS_PX,
            yAxis,
            ...(lengths ? { lengths } : {}),
          })
        : null,
    [on, store, unit, lengths, yAxis],
  );
  const offer = guides?.offer;
  useEffect(() => {
    if (!rulers || !offer) return;
    return offer({ rulers, yDir: yAxis === 'up' ? -1 : 1 });
  }, [rulers, offer, yAxis]);
  return rulers;
}

/** Rulers for a labkit camera, which has no scene: its contribution also hands the camera's actions the guides as
 *  their `snap` dep while snapping is on, and commits guide edits to the trial's undo. */
export function useCameraRulers(
  option: RulersOption | undefined,
  yAxis: RulersYAxis,
  guides: TrialGuides | null,
): { rulers: Rulers; contribution: SurfaceContribution } | null {
  const rulers = useOfferedRulers(option, yAxis, guides);
  const shownNow = guides?.shownNow;
  const snapping = guides?.snapping;
  const snapDep = guides?.snapDep;
  const commit = guides?.commit;
  return useMemo(() => {
    if (!rulers || !shownNow || !snapping || !snapDep || !commit) return null;
    const contribution = trialRulersEntry(rulers, shownNow, {
      snap: (below) => (snapping() ? snapDep : below()) as typeof snapDep,
      applyOps: () => commit,
    });
    return { rulers, contribution };
  }, [rulers, shownNow, snapping, snapDep, commit]);
}
