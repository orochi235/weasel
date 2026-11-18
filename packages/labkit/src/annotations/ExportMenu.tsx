import { ActionButton } from '@weasel-js/ui/components/ActionButton';
import { Callout } from '@weasel-js/ui/components/Callout';
import { Icon } from '@weasel-js/ui/components/Icon';
import { useId, useState } from 'react';
import { icon } from '../icons.gen';
import { useAnnotationsOptional } from './AnnotationsContext';
import { copyCapture, downloadCapture } from './saveCapture';
import type { AnnotationsApi, CaptureOptions, CaptureResult } from './types';

const SCALES = [1, 2, 4] as const;
const FORMATS = [
  { id: 'png', label: 'PNG' },
  { id: 'svg', label: 'SVG' },
] as const;

type Format = (typeof FORMATS)[number]['id'];

/** One labeled row of radio choices. A <fieldset>/<legend> cannot do this: a
 *  legend is outside its fieldset's grid formatting context, so it will not
 *  take a grid column and every choice row drops below its own label. */
function ChoiceRow<T extends string | number>({
  label,
  name,
  choices,
  value,
  onChange,
}: {
  label: string;
  name: string;
  choices: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="lk-export__row">
      <span>{label}</span>
      <span className="lk-export__choices" role="radiogroup" aria-label={label}>
        {choices.map((c) => (
          <label key={c.id}>
            <input
              type="radio"
              name={name}
              checked={value === c.id}
              onChange={() => onChange(c.id)}
            />
            {c.label}
          </label>
        ))}
      </span>
    </div>
  );
}

/** One capture at a time, with what went wrong if it failed; `onDone` runs after one succeeds. */
function useCaptureRun(
  marks: AnnotationsApi | null,
  target: string | null,
  opts: CaptureOptions,
  onDone: () => void,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (then: (r: CaptureResult) => void | Promise<void>): Promise<void> => {
    if (!marks || !target) return;
    setBusy(true);
    setError(null);
    try {
      await then(await marks.capture(target, opts));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/**
 * Export a target's picture with its marks on it.
 *
 * A panel rather than a button because a mark belongs to a target: with more
 * than one pane, "export" on its own does not say what.
 *
 * Reads the store through the hook the way `<MarkList>` does — the chrome
 * context carries no instrument state and is not the route to it.
 */
export function ExportMenu() {
  const marks = useAnnotationsOptional();
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>('png');
  const [scale, setScale] = useState<number>(2);
  const titleId = useId();
  const targets = marks?.targets() ?? [];
  const chosen = targets.some((t) => t.id === target) ? target : (targets[0]?.id ?? null);
  const { busy, error, run } = useCaptureRun(marks, chosen, { format, scale }, () =>
    setOpen(false),
  );

  if (!marks) return null;
  return (
    <span className="lk-export" ref={setAnchor}>
      <ActionButton
        icon={<Icon name={icon('ui:export')} size={16} />}
        label="Export"
        active={open}
        onPress={() => setOpen((was) => !was)}
      />
      <Callout
        triggerRef={{ current: anchor }}
        open={open}
        onOpenChange={setOpen}
        onDismiss={() => setOpen(false)}
        placement="bottom end"
        aria-labelledby={titleId}
      >
        <div className="lk-export__panel">
          <span className="lk-export__title" id={titleId}>
            Export
          </span>

          <label className="lk-export__row">
            <span>Target</span>
            {/* Native controls: role, name and keyboard operability for free,
                and a five-control panel is not the place to rebuild them. */}
            <select
              aria-label="Target"
              value={chosen ?? ''}
              onChange={(e) => setTarget(e.target.value)}
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id}
                </option>
              ))}
            </select>
          </label>

          <ChoiceRow
            label="Format"
            name="lk-export-format"
            choices={FORMATS}
            value={format}
            onChange={setFormat}
          />
          <ChoiceRow
            label="Scale"
            name="lk-export-scale"
            choices={SCALES.map((s) => ({ id: s, label: `${s}×` }))}
            value={scale}
            onChange={setScale}
          />

          <div className="lk-export__actions">
            <button type="button" disabled={busy || !chosen} onClick={() => run(downloadCapture)}>
              Download
            </button>
            <button type="button" disabled={busy || !chosen} onClick={() => run(copyCapture)}>
              Copy
            </button>
          </div>

          {error ? (
            <p className="lk-export__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Callout>
    </span>
  );
}
