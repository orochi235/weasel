import { type ReactNode, useState } from 'react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { type PropertyMetricProps, type PropertyRowLayout, PropertyRow } from './PropertyPanel';
import s from './Properties.module.css';

/** Props for `<DialogRow>`. */
export interface DialogRowProps extends PropertyMetricProps {
  label: ReactNode;
  /** What the row shows of the value, on the button that opens the dialog. One
   *  line; a longer one is cut off with an ellipsis. */
  summary: ReactNode;
  /** The dialog's body. A function runs only while the dialog is open, as a
   *  component — it may use hooks — and is handed `close`. */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** The dialog's heading. Defaults to `label`. */
  title?: ReactNode;
  /** Dialog footer. Defaults to a Done button; `null` draws none. */
  footer?: ReactNode | null;
  layout?: PropertyRowLayout;
  description?: string;
  /** Right-aligned readout shown next to the label — see `<PropertyRow readout>`. */
  readout?: ReactNode;
  /** Take the full width of the enclosing grid — see `<PropertyRow span>`. */
  span?: boolean;
  /** The row is auto — see `<PropertyRow auto>`. */
  auto?: boolean;
  /** Toggles `auto` from the row's label — see `<PropertyRow onAutoChange>`. */
  onAutoChange?: (next: boolean) => void;
}

/**
 * A row for a value too big to edit in place: it shows a one-line summary on a
 * button, and the button opens a modal holding whatever editor the row is
 * given. The body edits live — the dialog is room, not a transaction.
 */
export function DialogRow({
  label,
  summary,
  children,
  title,
  footer,
  layout,
  description,
  readout,
  span,
  density,
  align,
  auto,
  onAutoChange,
}: DialogRowProps) {
  const [open, setOpen] = useState(false);
  const close = (): void => setOpen(false);
  const name = typeof label === 'string' ? label : undefined;
  return (
    <PropertyRow
      label={label}
      readout={readout}
      layout={layout}
      description={description}
      span={span}
      density={density}
      align={align}
      auto={auto}
      onAutoChange={onAutoChange}
      // A `<label>` hands a click on its text to its button, which would open
      // the dialog from the label — and the label is the auto toggle.
      group
    >
      <button
        type="button"
        className={s.dialogTrigger}
        aria-haspopup="dialog"
        aria-label={name === undefined ? undefined : `Edit ${name}`}
        onClick={() => setOpen(true)}
      >
        <span className={s.dialogSummary}>{summary}</span>
        <span className={s.dialogGlyph} aria-hidden="true">
          …
        </span>
      </button>
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        title={title ?? label}
        footer={
          footer === undefined ? (
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          ) : (
            (footer ?? undefined)
          )
        }
      >
        {typeof children === 'function' ? <DialogBody render={children} close={close} /> : children}
      </Dialog>
    </PropertyRow>
  );
}

/** Calls a function body as a component, so it runs only while the dialog is
 *  mounted and may use hooks of its own. */
function DialogBody({
  render,
  close,
}: {
  render: (close: () => void) => ReactNode;
  close: () => void;
}) {
  return render(close);
}
