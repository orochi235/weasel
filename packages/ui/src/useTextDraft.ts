import { useRef, useState } from 'react';
import { useIdleSettle } from './useIdleSettle';

/** What {@link useTextDraft} edits: the committed text and where an edit to it lands. */
export interface TextDraftTarget {
  value: string;
  /** The committed text, only when it changed: on `settle`, and once typing rests where it settles when idle. */
  onChange: (next: string) => void;
  /** Each keystroke, and on Escape the value it last committed. */
  onInput?: (next: string) => void;
  /** Overrides the `typing.settleWhenIdle` kit setting. */
  settleWhenIdle?: boolean;
}

/**
 * The text a field shows and how an edit to it lands: the draft shows while it
 * differs from `value`, `onInput` gets each keystroke, and the draft settles
 * through `onChange` on blur or Enter, and once typing rests where it settles when
 * idle. Escape drops it, and gives `onInput` back the value it last committed.
 * `drop` discards the draft for a caller that has written it some other way.
 */
export function useTextDraft(p: TextDraftTarget) {
  const [draft, setDraft] = useState<string | null>(null);
  // Escape leaves by blurring, and that blur runs the handler of the render before the draft was dropped.
  const canceled = useRef(false);
  const { value } = p;
  // The draft stays up after an idle commit, so a commit that rewrites the text does not move it under the caret.
  const idle = useIdleSettle(() => {
    if (draft !== null && draft !== value) p.onChange(draft);
  }, p.settleWhenIdle);
  const drop = (): void => {
    idle.stop();
    setDraft(null);
  };
  return {
    draft,
    shown: draft ?? value,
    type: (next: string) => {
      canceled.current = false;
      setDraft(next);
      idle.typed();
      p.onInput?.(next);
    },
    settle: () => {
      if (draft !== null && draft !== value && !canceled.current) p.onChange(draft);
      canceled.current = false;
      drop();
    },
    drop,
    keyDown: (e: { key: string; target: EventTarget }) => {
      if (e.key !== 'Escape') return;
      canceled.current = true;
      if (draft !== null) p.onInput?.(value);
      drop();
      (e.target as HTMLElement).blur();
    },
  };
}
