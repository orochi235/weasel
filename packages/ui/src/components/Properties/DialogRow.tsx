import { type ReactNode, useState } from 'react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { type PropertyRowLayout, PropertyRow } from './PropertyRow';
import { type PropertyMetricProps } from './metrics';
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
  /** Dialog footer. Defaults to a Done button, with Cancel before it where `onCancel` is given; `null` draws none. */
  footer?: ReactNode | null;
  /** The dialog opened. */
  onOpen?: () => void;
  /** The dialog closed by Done, by its body's `close`, or — with no `onCancel` — by Escape or a press outside it. */
  onDone?: () => void;
  /** Given, the dialog can be closed without keeping its edits: Cancel, Escape, or a press outside it closes it
   *  through this. An owner holding the body's edits as a draft drops them here and keeps them in `onDone`. */
  onCancel?: () => void;
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
  /** What the row reads when it is auto — see `<PropertyRow autoValue>`. */
  autoValue?: ReactNode;
  /** The row takes no input: its button is disabled, and still reads the summary. */
  disabled?: boolean;
  /** The value differs from a baseline of the caller's — see `<PropertyRow changed>`. */
  changed?: boolean;
  /** What is wrong with the value — see `<PropertyRow error>`. */
  error?: ReactNode;
}

/**
 * A row for a value too big to edit in place: it shows a one-line summary on a
 * button, and the button opens a modal holding whatever editor the row is
 * given. The dialog is room, not a transaction, unless its owner makes it one
 * with `onDone` and `onCancel`.
 */
export function DialogRow({
  label,
  summary,
  children,
  title,
  footer,
  onOpen,
  onDone,
  onCancel,
  layout,
  description,
  readout,
  span,
  density,
  align,
  auto,
  onAutoChange,
  autoValue,
  disabled,
  changed,
  error,
}: DialogRowProps) {
  const [open, setOpen] = useState(false);
  const close = (): void => {
    setOpen(false);
    onDone?.();
  };
  const cancel = (): void => {
    setOpen(false);
    onCancel?.();
  };
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
      autoValue={autoValue}
      disabled={disabled}
      changed={changed}
      error={error}
      // A `<label>` hands a click on its text to its button, which would open
      // the dialog from the label — and the label is the auto toggle.
      group
    >
      <button
        type="button"
        className={s.dialogTrigger}
        aria-haspopup="dialog"
        aria-label={name === undefined ? undefined : `Edit ${name}`}
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          onOpen?.();
        }}
      >
        <span className={s.dialogSummary}>{summary}</span>
        <span className={s.dialogGlyph} aria-hidden="true">
          …
        </span>
      </button>
      <Dialog
        isOpen={open}
        onOpenChange={(next) => {
          if (next) return;
          if (onCancel) cancel();
          else close();
        }}
        title={title ?? label}
        footer={
          footer === undefined ? (
            <>
              {onCancel && (
                <Button variant="ghost" onClick={cancel}>
                  Cancel
                </Button>
              )}
              <Button variant="primary" onClick={close}>
                Done
              </Button>
            </>
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
