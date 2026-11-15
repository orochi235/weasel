import { useState } from 'react';
import { useTextDraft } from '../../useTextDraft';

/**
 * The draft of the text entry being typed in, held like every other typed field's until blur, Enter or a rest.
 * `typed` is the list with the draft in it: an edit to the list as a whole starts from it and goes through
 * `write`, which drops the draft so the edit lands as one change. A draft belongs to the entry it began on: moving
 * to another entry commits it there first.
 */
export function useEntryDraft<T>(value: readonly T[], onChange: (next: T[]) => void, settleWhenIdle?: boolean) {
  const [at, setAt] = useState(0);
  const put = (list: readonly T[], text: string): T[] => list.map((v, j) => (j === at ? (text as T) : v));
  const edit = useTextDraft({
    value: at < value.length ? (value[at] as string) : '',
    onChange: (text) => onChange(put(value, text)),
    settleWhenIdle,
  });
  const typed = edit.draft === null || at >= value.length ? value : put(value, edit.draft);
  return {
    typed,
    shown: (i: number): string => (i === at ? edit.shown : (value[i] as string)),
    focus: (i: number): void => {
      if (i === at) return;
      edit.settle();
      setAt(i);
    },
    type: (i: number, text: string): void => {
      if (i === at) return edit.type(text);
      edit.settle();
      setAt(i);
      edit.type(text, value[i] as string);
    },
    settle: edit.settle,
    keyDown: edit.keyDown,
    write: (next: T[]): void => {
      edit.drop();
      onChange(next);
    },
  };
}
