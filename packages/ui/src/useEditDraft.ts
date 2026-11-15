import { useCallback, useState } from 'react';
import { useLatest } from '@weasel-js/core';
import { deepEqual } from '@weasel-js/registry';

/** The edit callbacks a control reports through, as `docs/conventions.md` ("Edit callbacks") defines them. */
export interface EditCallbacks<V> {
  onInput?: (next: V) => void;
  onChange?: (next: V) => void;
  onCancel?: () => void;
}

/**
 * What a controlled control draws while an edit runs. Given `onInput`, the consumer owns the preview and the
 * control draws `value` throughout; without it, the control draws what it would have sent there until the edit
 * commits or is canceled, so a commit-only consumer still sees the drag. A `value` that moves away from the one the
 * draft began over (`same` says whether it has, by structure unless given) wins over the draft: an edit that ended
 * without a commit, a native range dragged back to where it began, leaves nothing to mask the next value, while a
 * consumer rebuilding the same value each render keeps the draft.
 */
export function useEditDraft<V>(value: V, cb: EditCallbacks<V>, same: (a: V, b: V) => boolean = deepEqual) {
  const [draft, setDraft] = useState<{ next: V; from: V } | null>(null);
  const valueRef = useLatest(value);
  const latest = useLatest(cb);
  const onInput = useCallback((next: V) => {
    const own = latest.current.onInput;
    if (own) own(next);
    else setDraft({ next, from: valueRef.current });
  }, [latest, valueRef]);
  const onChange = useCallback((next: V) => {
    setDraft(null);
    latest.current.onChange?.(next);
  }, [latest]);
  const onCancel = useCallback(() => {
    setDraft(null);
    latest.current.onCancel?.();
  }, [latest]);
  return { shown: draft && !cb.onInput && same(draft.from, value) ? draft.next : value, onInput, onChange, onCancel };
}
