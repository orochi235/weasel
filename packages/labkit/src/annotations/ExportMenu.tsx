import { ExportIcon } from '@weasel-js/ui';
import { useId, useState } from 'react';
import { Callout } from '../passthrough/weasel-ui';
import { Toolbar } from '../primitives/Toolbar';
import { useAnnotationsOptional } from './AnnotationsContext';
import type { CaptureResult } from './types';

const SCALES = [1, 2, 4] as const;
const FORMATS = [
  { id: 'png', label: 'PNG' },
  { id: 'svg', label: 'SVG' },
] as const;

type Format = (typeof FORMATS)[number]['id'];

function fileName(result: CaptureResult): string {
  return `${result.target.replace(/[^a-z0-9._-]+/gi, '-')}.${result.format}`;
}

/** A blob the person asked for, handed to the browser's own save flow. The
 *  object URL is revoked on the next turn — revoking it synchronously races
 *  the navigation the click starts. */
function download(result: CaptureResult): void {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(result);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** PNG goes to the clipboard as an image. SVG goes as text: `image/svg+xml`
 *  needs Chromium's `web ` prefix and nothing else reads it, while the markup
 *  is what a person pasting a vector export actually wants. */
async function copy(result: CaptureResult): Promise<void> {
  if (result.format === 'svg') {
    await navigator.clipboard.writeText(await result.blob.text());
    return;
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': result.blob })]);
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
  // The anchor doubles as the portal target lookup: a React Aria popover
  // portals to `document.body` by default, which is outside the element
  // labkit paints its theme tokens onto — `--wzl-surface` does not exist
  // there and the panel renders unthemed.
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>('png');
  const [scale, setScale] = useState<number>(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  if (!marks) return null;
  const targets = marks.targets();
  const chosen = target ?? targets[0]?.id ?? null;

  const run = async (then: (r: CaptureResult) => void | Promise<void>): Promise<void> => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      await then(await marks.capture(chosen, { format, scale }));
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="lk-export" ref={setAnchor}>
      <Toolbar.Button
        iconOnly
        pressed={open}
        aria-label="Export"
        title="Export"
        onClick={() => setOpen((was) => !was)}
      >
        <ExportIcon size={16} />
      </Toolbar.Button>
      <Callout
        triggerRef={{ current: anchor }}
        isOpen={open}
        onOpenChange={setOpen}
        onDismiss={() => setOpen(false)}
        placement="bottom end"
        UNSTABLE_portalContainer={anchor?.closest('.lk-root') ?? undefined}
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

          {/* A <fieldset>/<legend> cannot do this: a legend is outside its
              fieldset's grid formatting context, so it will not take a grid
              column and every choice row drops below its own label. */}
          <div className="lk-export__row">
            <span>Format</span>
            <span className="lk-export__choices" role="radiogroup" aria-label="Format">
              {FORMATS.map((f) => (
                <label key={f.id}>
                  <input
                    type="radio"
                    name="lk-export-format"
                    checked={format === f.id}
                    onChange={() => setFormat(f.id)}
                  />
                  {f.label}
                </label>
              ))}
            </span>
          </div>

          <div className="lk-export__row">
            <span>Scale</span>
            <span className="lk-export__choices" role="radiogroup" aria-label="Scale">
              {SCALES.map((s) => (
                <label key={s}>
                  <input
                    type="radio"
                    name="lk-export-scale"
                    checked={scale === s}
                    onChange={() => setScale(s)}
                  />
                  {s}×
                </label>
              ))}
            </span>
          </div>

          <div className="lk-export__actions">
            <button type="button" disabled={busy || !chosen} onClick={() => run(download)}>
              Download
            </button>
            <button type="button" disabled={busy || !chosen} onClick={() => run(copy)}>
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
