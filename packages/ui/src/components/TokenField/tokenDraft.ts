import { useState } from 'react';

/** What {@link useTokenDraft} reads. */
export interface TokenDraftArgs<T> {
  value: readonly T[];
  onChange: (next: T[]) => void;
  create: (text: string) => T | undefined;
  maxItems: number;
  focusChip: (at: number) => void;
}

/** The text typed into a {@link TokenField}, and the adds that turn it into tokens. */
export function useTokenDraft<T>({ value, onChange, create, maxItems, focusChip }: TokenDraftArgs<T>) {
  const [draft, setDraft] = useState('');
  const full = value.length >= maxItems;

  /** Adds a token for each text that makes one while there is room, and returns the rest. `focused` while the text
   *  field keeps focus: filling the list disables the field, so focus moves to the last chip. */
  const add = (texts: readonly string[], focused: boolean): string[] => {
    const made: T[] = [];
    const left: string[] = [];
    for (const raw of texts) {
      const text = raw.trim();
      if (text === '') continue;
      const token = value.length + made.length < maxItems ? create(text) : undefined;
      if (token === undefined) left.push(text);
      else made.push(token);
    }
    if (made.length === 0) return left;
    onChange([...value, ...made]);
    if (focused && value.length + made.length >= maxItems) focusChip(value.length + made.length - 1);
    return left;
  };
  const commit = (focused: boolean): void => {
    if (draft.trim() !== '' && !full) setDraft(add(draft.split(','), focused).join(', '));
  };
  // Pasted or composed text can hold commas, which end tokens as a typed one does.
  const type = (text: string): void => {
    if (!text.includes(',')) { setDraft(text); return; }
    const parts = text.split(',');
    const tail = parts.pop()!;
    const left = add(parts, true);
    setDraft(left.length === 0 ? tail : [...left, tail.trimStart()].join(', '));
  };

  return { draft, full, commit, type };
}
