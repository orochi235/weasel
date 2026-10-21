import { isDev } from '@weasel-js/react';
import { DialogRow, type DialogRowProps } from '@weasel-js/ui/components/Properties';
import { type ReactNode, useRef, useState } from 'react';

/** Props for {@link DraftDialogRow}: a `DialogRow`'s, with the value its body edits. */
export interface DraftDialogRowProps
  extends Omit<DialogRowProps, 'children' | 'onOpen' | 'onDone' | 'onCancel'> {
  value: unknown;
  setValue: (value: unknown) => void;
  /** Turns the draft into the value Done writes. Runs once at Done, and only on a draft that was edited. */
  commit?: (draft: unknown) => unknown;
  /** The dialog's body, editing `value` as a draft. */
  children: (value: unknown, setValue: (value: unknown) => void) => ReactNode;
}

const lateWrite = (label: ReactNode): string =>
  `[labkit] the dialog for ${typeof label === 'string' ? `"${label}"` : 'a row'} had closed, so a write ` +
  'from its body was dropped. A dialog body should write each edit into the draft as it is made, not when it closes.';

/**
 * A dialog row whose body edits a draft: Done writes it, once, and Cancel or
 * Escape drops it. So an edit made in the dialog is one undo step, and the
 * states a body passes through on the way are never written.
 */
export function DraftDialogRow({ value, setValue, commit, children, ...row }: DraftDialogRowProps) {
  const [draft, setDraft] = useState<{ value: unknown } | null>(null);
  const open = useRef(false);
  const closed = (): void => {
    open.current = false;
    setDraft(null);
  };
  const write = (next: unknown): void => {
    if (open.current) setDraft({ value: next });
    else if (isDev()) console.warn(lateWrite(row.label));
  };
  return (
    <DialogRow
      {...row}
      onOpen={() => {
        open.current = true;
        setDraft(null);
      }}
      onDone={() => {
        if (draft !== null) setValue(commit ? commit(draft.value) : draft.value);
        closed();
      }}
      onCancel={closed}
    >
      {() => children(draft === null ? value : draft.value, write)}
    </DialogRow>
  );
}
