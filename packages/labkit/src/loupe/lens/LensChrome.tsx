import { useActionsRegistry } from '@weasel-js/core';
import { ToggleBar } from '@weasel-js/ui/components/ToggleBar';
import { useLensResolution, useShownSource } from './LensSlot';
import { LENS_ACTION_IDS } from './lensActionDefs';
import { type LensSlotProps, requestsOf } from './lensSource';
import type { LensReadout, LensSourceKind, LensView } from './lensTypes';
import { GRID_NEEDS, gridFits } from './pixelGrid';

const SOURCE_TOGGLES: readonly { kind: LensSourceKind; label: string; id: string }[] = [
  { kind: 'live', label: 'Live', id: LENS_ACTION_IDS.live },
  { kind: 'pixels', label: 'Pixels', id: LENS_ACTION_IDS.pixels },
];

const VIEW_TOGGLES: readonly { view: LensView; label: string; id: string }[] = [
  { view: 'swap', label: 'Swap', id: LENS_ACTION_IDS.swap },
  { view: 'split', label: 'Split', id: LENS_ACTION_IDS.split },
  { view: 'difference', label: 'Difference', id: LENS_ACTION_IDS.difference },
];

const READOUT_TOGGLES: readonly { readout: LensReadout; label: string; id: string }[] = [
  { readout: 'token', label: 'Token', id: LENS_ACTION_IDS.token },
  { readout: 'contrast', label: 'Contrast', id: LENS_ACTION_IDS.contrast },
  { readout: 'grid', label: 'Grid', id: LENS_ACTION_IDS.grid },
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
  // The grid has no meaning over a render of the DOM, or below 8× a captured pixel.
  const gridOk =
    shownRequests.length > 0 &&
    shownRequests.every((r) => gridFits(shown.source?.kind ?? null, r.factor, r.dpr)) &&
    !difference;
  const at = { lensId: lens.lensId, reticle, source: shown.source?.kind ?? null };
  const fire = (id: string | undefined): void => {
    if (id === undefined) return;
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
        <ToggleBar
          ariaLabel="Source"
          size="sm"
          variant="minimal"
          items={SOURCE_TOGGLES.map((t) => ({ value: t.kind, label: t.label }))}
          value={source?.kind ?? null}
          // The pressed source may be a fallback for the one wanted, so pressing it again still asks for it.
          allowDeselect
          onChange={(next) =>
            fire(SOURCE_TOGGLES.find((t) => t.kind === (next ?? source?.kind))?.id)
          }
        />
        <ToggleBar
          ariaLabel="Readouts"
          mode="multiple"
          size="sm"
          variant="minimal"
          items={READOUT_TOGGLES.map((t) => ({
            value: t.readout,
            label:
              t.readout === 'grid' && settings.readouts.includes('grid') && !gridOk
                ? GRID_NEEDS
                : t.label,
          }))}
          value={settings.readouts}
          onChange={(next) =>
            fire(
              READOUT_TOGGLES.find(
                (t) => next.includes(t.readout) !== settings.readouts.includes(t.readout),
              )?.id,
            )
          }
        />
        {settings.compare !== null ? (
          <ToggleBar
            ariaLabel="View"
            size="sm"
            variant="minimal"
            items={VIEW_TOGGLES.map((t) => ({ value: t.view, label: t.label }))}
            value={settings.view}
            onChange={(next) => fire(VIEW_TOGGLES.find((t) => t.view === next)?.id)}
          />
        ) : null}
      </span>
    </div>
  );
}
