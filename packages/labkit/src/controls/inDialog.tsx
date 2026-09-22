import { DialogRow } from '@weasel-js/ui';
import type { ReactNode } from 'react';
import type { ControlRenderer } from '../config/types';

/** Options for {@link inDialog}. */
export interface InDialogOptions {
  /** What the row's button shows of the value. Defaults to a list joined with
   *  commas, or the value itself. */
  summary?: (value: unknown) => ReactNode;
  /** The dialog's heading. Defaults to the row's label. */
  title?: ReactNode;
}

/** The one-line summary a dialog row shows when it is given none. */
export function summarizeValue(value: unknown): string {
  if (Array.isArray(value)) return value.length === 0 ? 'None' : value.join(', ');
  if (value === undefined || value === null || value === '') return 'None';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * Moves a control into a modal: the row becomes a button showing a summary of
 * the value, and the button opens a dialog whose body is `body`, handed the
 * same context a row renderer gets. For a leaf whose editor will never fit a
 * sidebar row.
 */
export function inDialog(body: ControlRenderer, opts: InDialogOptions = {}): ControlRenderer {
  const summary = opts.summary ?? summarizeValue;
  return (ctx) => {
    const { pref, value, auto, setAuto } = ctx;
    const manual = (pref as { manual?: boolean }).manual === true;
    return (
      <DialogRow
        label={pref.name}
        description={pref.description}
        summary={summary(value)}
        title={opts.title}
        readout={auto ? 'auto' : undefined}
        auto={auto}
        onAutoChange={manual ? undefined : setAuto}
      >
        {() => body(ctx)}
      </DialogRow>
    );
  };
}
