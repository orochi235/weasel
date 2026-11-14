import { useMemo } from 'react';
import { withMarks } from '../annotations/labMarks';
import { builtinContributions, TRANSIENT_BUILTINS } from '../chrome/builtins';
import { mergeContributions, suppressContributions } from '../chrome/merge';
import type { TrialChromeContext, TrialContribution, TrialSidebar } from '../chrome/types';
import type { LeafRenderer } from '../config/types';
import type { Instrument } from '../instrument/types';
import { FLOAT_TOGGLE_ID, floatToggle } from './FloatSidebar';

/** What a trial's chrome is assembled from. */
export interface TrialContributionSources {
  instrument: Instrument;
  ctx: TrialChromeContext;
  marks: boolean;
  renderers?: Record<string, LeafRenderer>;
  trialChrome?: readonly TrialContribution[];
  chrome?: readonly TrialContribution[];
  suppress?: readonly string[];
  hide?: readonly string[];
  sidebar: TrialSidebar;
}

/**
 * The trial's contributions: the instrument's, the runtime's and the lab's, merged and suppressed. `offered` is
 * what the trial binds keys for; `shown` is what its regions draw, which leaves out the ones `hide` names.
 */
export function useTrialContributions({
  instrument,
  ctx,
  marks,
  renderers,
  trialChrome,
  chrome,
  suppress,
  hide,
  sidebar,
}: TrialContributionSources): { offered: TrialContribution[]; shown: TrialContribution[] } {
  const floating = sidebar === 'float';
  const offered = useMemo(() => {
    const kept = suppressContributions(
      mergeContributions(
        floating ? [floatToggle] : [],
        builtinContributions(withMarks(instrument, marks), ctx, renderers),
        [...(instrument.chrome ?? [])],
        [...(trialChrome ?? [])],
        [...(chrome ?? [])],
      ),
      suppress ?? [],
      TRANSIENT_BUILTINS,
    );
    // Nothing to float, nothing to open.
    return kept.some((c) => c.region === 'sidebar')
      ? kept
      : kept.filter((c) => c.id !== FLOAT_TOGGLE_ID);
  }, [floating, instrument, ctx, trialChrome, chrome, suppress, renderers, marks]);
  const shown = useMemo(
    () => suppressContributions(offered, hide ?? [], TRANSIENT_BUILTINS, 'hide'),
    [offered, hide],
  );
  return { offered, shown };
}
