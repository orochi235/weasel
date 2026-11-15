import { useRef, useState } from 'react';
import { useIdleSettle } from './useIdleSettle';

/** What {@link useTextDraft} edits: the committed text and where an edit to it lands. */
export interface TextDraftTarget {
  value: string;
  /** The committed text, only when it changed: on `settle`, and once typing rests where it settles when idle. */
  onChange: (next: string) => void;
  /** Each keystroke, and on Escape the value it last committed. */
  onInput?: (next: string) => void;
  /** Escape dropped a draft. */
  onCancel?: () => void;
  /** Overrides the `typing.settleWhenIdle` kit setting. */
  settleWhenIdle?: boolean;
}

/**
 * The text a field shows and how an edit to it lands: the draft shows while it
 * differs from `value`, `onInput` gets each keystroke, and the draft settles
 * through `onChange` on blur or Enter, and once typing rests where it settles when
 * idle. Escape cancels it: `onInput` gets back the value it last committed, then `onCancel` runs.
 * `drop` discards the draft for a caller that has written it some other way.
 */
export function useTextDraft(p: TextDraftTarget) {
  const [draft, setDraft] = useState<string | null>(null);
  // Escape leaves by blurring, and that blur runs the handler of the render before the draft was dropped.
  const canceled = useRef(false);
  // The text the edit began from, or last committed: a caller previewing through `onInput` holds the draft as its
  // value, so a commit or a cancel measures against this rather than `value`.
  const from = useRef<string | null>(null);
  const { value } = p;
  // The draft stays up after an idle commit, so a commit that rewrites the text does not move it under the caret.
  const idle = useIdleSettle(() => {
    if (draft === null || draft === (from.current ?? value)) return;
    from.current = draft;
    p.onChange(draft);
  }, p.settleWhenIdle);
  const drop = (): void => {
    idle.stop();
    from.current = null;
    setDraft(null);
  };
  return {
    draft,
    shown: draft ?? value,
    /** `began` is the text an edit starting with this keystroke begins from, for a caller whose `value` moves to
     *  another text in the same event; it defaults to `value`. */
    type: (next: string, began: string = value) => {
      canceled.current = false;
      from.current ??= began;
      setDraft(next);
      idle.typed();
      p.onInput?.(next);
    },
    settle: () => {
      if (draft !== null && draft !== (from.current ?? value) && !canceled.current) p.onChange(draft);
      canceled.current = false;
      drop();
    },
    drop,
    keyDown: (e: { key: string; target: EventTarget }) => {
      if (e.key !== 'Escape') return;
      canceled.current = true;
      const began = from.current ?? value;
      drop();
      if (draft !== null) {
        p.onInput?.(began);
        p.onCancel?.();
      }
      (e.target as HTMLElement).blur();
    },
  };
}
