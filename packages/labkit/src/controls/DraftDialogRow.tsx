import { DialogRow, type DialogRowProps } from '@weasel-js/ui';
import { type ReactNode, useState } from 'react';

/** Props for {@link DraftDialogRow}: a `DialogRow`'s, with the value its body edits. */
export interface DraftDialogRowProps
  extends Omit<DialogRowProps, 'children' | 'onOpen' | 'onDone' | 'onCancel'> {
  value: unknown;
  setValue: (value: unknown) => void;
  /** The dialog's body, editing `value` as a draft. */
  children: (value: unknown, setValue: (value: unknown) => void) => ReactNode;
}

/**
 * A dialog row whose body edits a draft: Done writes it, once, and Cancel or
 * Escape drops it. So an edit made in the dialog is one undo step, and the
 * states a body passes through on the way are never written.
 */
export function DraftDialogRow({ value, setValue, children, ...row }: DraftDialogRowProps) {
  const [draft, setDraft] = useState<{ value: unknown } | null>(null);
  return (
    <DialogRow
      {...row}
      onOpen={() => setDraft(null)}
      onDone={() => {
        if (draft !== null) setValue(draft.value);
        setDraft(null);
      }}
      onCancel={() => setDraft(null)}
    >
      {() => children(draft === null ? value : draft.value, (next) => setDraft({ value: next }))}
    </DialogRow>
  );
}
