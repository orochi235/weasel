import { useCallback } from 'react';
import { useLatest } from '@weasel-js/react';
import { useEditDraft } from '../../useEditDraft';
import { useAttachRef } from '../../useAttachRef';

/**
 * A range's edit callbacks, `docs/conventions.md` ("Edit callbacks") under value names, since `onInput`,
 * `onChange` and `onCancel` are the native element's own events: `onValueInput` previews each move,
 * `onValueChange` commits once per drag or key step, and `onValueCancel` follows Escape mid-drag or an unmount.
 */
export interface RangeEditProps {
  onValueInput?: (next: number) => void;
  onValueChange?: (next: number) => void;
  onValueCancel?: () => void;
}

interface OpenEdit {
  from: number;
  last: number;
  canceled: boolean;
}

/**
 * The edit protocol over a native range. The value to draw, and a ref callback for the input.
 *
 * A native range fires `input` through a drag and `change` once at its end (once per key step from the keyboard),
 * and React's `onChange` sees only the first, so both are read off listeners of the element's own.
 */
export function useRangeEdit(value: number, cb: RangeEditProps, refuses: boolean) {
  const draft = useEditDraft<number>(value, { onInput: cb.onValueInput, onChange: cb.onValueChange, onCancel: cb.onValueCancel }, Object.is);
  // A range given none of them is a plain native one, drawing `value` throughout.
  const reports = cb.onValueInput !== undefined || cb.onValueChange !== undefined || cb.onValueCancel !== undefined;
  const live = useLatest({ draft, refuses: refuses || !reports });
  const attach = useCallback((el: HTMLInputElement) => {
    let edit: OpenEdit | null = null;
    // What a release committed, so the `change` a browser fires after it is not a second edit.
    let released: number | null = null;
    const read = () => Number(el.value);
    const open = (): OpenEdit => (edit ??= { from: live.current.draft.shown, last: live.current.draft.shown, canceled: false });
    const commit = () => {
      const done = edit;
      edit = null;
      if (done && !done.canceled && done.last !== done.from) live.current.draft.onChange(done.last);
      return done;
    };
    const cancel = (e: OpenEdit) => {
      e.canceled = true;
      live.current.draft.onInput(e.from);
      live.current.draft.onCancel();
    };
    const onInput = () => {
      if (live.current.refuses) return;
      released = null;
      const e = open();
      if (e.canceled) return;
      e.last = read();
      live.current.draft.onInput(e.last);
    };
    const onChange = () => {
      if (live.current.refuses || edit?.canceled) return;
      if (edit === null) {
        const at = read();
        const echo = at === released;
        released = null;
        if (echo || at === live.current.draft.shown) return;
        onInput();
      }
      commit();
    };
    // Whether a browser fires `change` before the release or after it, or not at all for a drag back to where it began.
    const onRelease = () => {
      if (edit?.canceled) edit = null;
      else released = commit()?.last ?? released;
      document.removeEventListener('pointerup', onRelease);
      document.removeEventListener('pointercancel', onRelease);
    };
    const onPress = () => {
      document.addEventListener('pointerup', onRelease);
      document.addEventListener('pointercancel', onRelease);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || edit === null || edit.canceled) return;
      ev.preventDefault();
      cancel(edit);
    };
    const onBlur = () => {
      if (edit?.canceled) edit = null;
      else commit();
    };
    const listeners = {
      input: onInput, change: onChange, pointerdown: onPress, pointerup: onRelease, pointercancel: onRelease, keydown: onKey, blur: onBlur,
    } as const;
    for (const [type, fn] of Object.entries(listeners)) el.addEventListener(type, fn as EventListener);
    return () => {
      for (const [type, fn] of Object.entries(listeners)) el.removeEventListener(type, fn as EventListener);
      if (edit && !edit.canceled) cancel(edit);
      onRelease();
    };
  }, [live]);
  return { shown: reports ? draft.shown : value, ref: useAttachRef(attach) };
}
