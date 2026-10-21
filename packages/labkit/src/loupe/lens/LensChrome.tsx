import { useActionsRegistry } from '@weasel-js/core';
import { LENS_ACTION_IDS } from './lensActionDefs';
import { type LensSlotProps, requestsOf } from './lensSource';
import { useLensResolution, useShownSource } from './LensSlot';
import type { LensSourceKind, LensView } from './lensTypes';

const SOURCE_TOGGLES: readonly { kind: LensSourceKind; label: string; id: string }[] = [
  { kind: 'live', label: 'Live', id: LENS_ACTION_IDS.live },
  { kind: 'pixels', label: 'Pixels', id: LENS_ACTION_IDS.pixels },
];

const VIEW_TOGGLES: readonly { view: LensView; label: string; id: string }[] = [
  { view: 'swap', label: 'Swap', id: LENS_ACTION_IDS.swap },
  { view: 'split', label: 'Split', id: LENS_ACTION_IDS.split },
  { view: 'difference', label: 'Difference', id: LENS_ACTION_IDS.difference },
];

/**
 * The strip on a lens: the source it actually shows (after any fallback, and
 * Pixels in Difference) and, with a comparison, what that is compared against. Its toggles trigger the
 * lens actions, so they act on the current lens.
 */
export function LensChrome<C>({
  lens,
  settings,
  sources,
  reticle,
  size,
  describe,
  onFocus,
}: LensSlotProps<C> & {
  /** Called with this lens's id before a toggle fires, so the action lands on it. */
  onFocus?: (lensId: string) => void;
}) {
  const registry = useActionsRegistry();
  // The toggles say which source the lens is set to; the label says what it shows.
  const { source } = useLensResolution(settings.source, sources);
  const shown = useShownSource(settings, sources);
  const difference = settings.compare !== null && settings.view === 'difference';
  const shownRequests = shown.source ? requestsOf(shown.source, lens, settings, reticle, size) : [];
  // Difference compares one pair of captures, at the first DPR.
  const labelled = difference ? shownRequests.slice(0, 1) : shownRequests;
  const labels = labelled.map((r) => shown.source?.label(r) ?? '');
  const at = { lensId: lens.lensId, reticle, source: shown.source?.kind ?? null };
  const trigger = (id: string) => () => {
    onFocus?.(lens.lensId);
    registry?.trigger(id);
  };
  return (
    <div className="lk-lens-chrome">
      <span className="lk-lens-chrome__label">
        {labels.join(' · ') || (difference ? shown.reason : null) || 'No source'}
      </span>
      {settings.compare !== null ? (
        <span className="lk-lens-chrome__compare">{describe(settings.compare, at)}</span>
      ) : null}
      <span className="lk-lens-chrome__toggles">
        {SOURCE_TOGGLES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="lk-lens-chrome__toggle"
            aria-pressed={source?.kind === t.kind}
            onClick={trigger(t.id)}
          >
            {t.label}
          </button>
        ))}
        {settings.compare !== null
          ? VIEW_TOGGLES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="lk-lens-chrome__toggle"
                aria-pressed={settings.view === t.view}
                onClick={trigger(t.id)}
              >
                {t.label}
              </button>
            ))
          : null}
      </span>
    </div>
  );
}
