import { useActionsRegistry } from '@weasel-js/core';
import { LENS_ACTION_IDS } from './lensActionDefs';
import { type LensSlotProps, requestsOf } from './lensSource';
import { useLensResolution } from './LensSlot';
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
 * The strip on a lens: the source it actually shows (after any fallback) and,
 * with a comparison, what that is compared against. Its toggles trigger the
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
  const { source } = useLensResolution(settings.source, sources);
  const labels = source
    ? requestsOf(source, lens, settings, reticle, size).map((r) => source.label(r))
    : [];
  const trigger = (id: string) => () => {
    onFocus?.(lens.lensId);
    registry?.trigger(id);
  };
  return (
    <div className="lk-lens-chrome">
      <span className="lk-lens-chrome__label">{labels.join(' · ') || 'No source'}</span>
      {settings.compare !== null ? (
        <span className="lk-lens-chrome__compare">{describe(settings.compare)}</span>
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
