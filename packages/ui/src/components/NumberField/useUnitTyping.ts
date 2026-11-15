import { type KeyboardEvent, type RefObject, useRef, useState } from 'react';
import { imeKey } from '@weasel-js/ui-input';
import { canSpin, clampToBounds, endlessAllows, spinKey, type Endless } from '@weasel-js/quantity';
import { useIdleSettle } from '../../useIdleSettle';

export type Bounds = Parameters<typeof clampToBounds>[1];

/** What a field's text commits through. */
export interface TypingCallbacks {
  onChange: (value: number) => void;
  onInput?: (value: number) => void;
  onOffset?: (delta: number) => void;
  onCancel?: () => void;
  onClear?: () => void;
}

/** The value typing began from, and whether any keystroke reached `onInput`. */
interface Typing {
  from: number;
  sent: boolean;
}

/** Whether the field can hold `n`: a finite number, or an infinity an endless end stands for. */
const holds = (n: number, endless: Endless | undefined): boolean => Number.isFinite(n) || endlessAllows(endless, n);

/** A typed `n` held to `bounds`, or NaN where even that is no value the field can hold: an infinity no bound clamps. */
function settled(n: number, bounds: Bounds): number {
  const next = clampToBounds(n, bounds);
  return holds(next, bounds.endless) ? next : Number.NaN;
}

/** What a step starts from: the text as typed where it reads as a value the field can hold, else the value. */
function stepStart(typed: number, value: number, endless: Endless | undefined): number {
  return holds(typed, endless) ? typed : holds(value, endless) ? value : 0;
}

/**
 * The text a person is typing into a number field, from first keystroke to commit: the draft, what each
 * keystroke sends to `onInput`, what blur, Enter, Escape, and a pause commit, and the steps an arrow takes.
 */
export function useUnitTyping({ value, read, bounds, disabled, settleWhenIdle, callbacks }: {
  value: number;
  read: (typed: string) => number;
  bounds: Bounds;
  disabled: boolean;
  settleWhenIdle?: boolean;
  callbacks: TypingCallbacks;
}) {
  const { onChange, onInput, onOffset, onClear } = callbacks;
  const [draft, setDraft] = useState<string | null>(null);
  const canceled = useRef(false);
  const typing = useRef<Typing | null>(null);
  const idle = useIdleSettle(() => {
    const n = idleValue(draft, read, bounds);
    if (n === null) return;
    const began = typing.current?.from ?? value;
    typing.current = { from: n, sent: false };
    if (n !== began) onChange(n);
  }, settleWhenIdle);

  const from = (): number => stepStart(draft === null ? value : read(draft), value, bounds.endless);
  const spin = (key: string): boolean => {
    const next = disabled ? null : spinKey(key, from(), bounds);
    if (next === null) return false;
    idle.stop();
    setDraft(null);
    typing.current = null;
    onInput?.(next);
    if (next !== value) onChange(next);
    return true;
  };
  /** Whether `key` has nowhere left to step to. */
  const spent = (key: string): boolean => !canSpin(key, from(), bounds);

  const type = (typed: string) => {
    setDraft(typed);
    idle.typed();
    typing.current ??= { from: value, sent: false };
    const n = settled(read(typed), bounds);
    if (onInput && typed.trim() !== '' && !Number.isNaN(n)) {
      typing.current.sent = true;
      onInput(n);
    }
  };
  const focus = () => {
    canceled.current = false;
  };
  const leave = () => {
    idle.stop();
    const typedText = canceled.current ? null : draft;
    const by = typedText === null ? null : offsetIn(typedText, read);
    if (typedText?.trim() === '' && !Number.isNaN(value) && onClear) onClear();
    else if (by !== null && Number.isFinite(by) && onOffset) onOffset(by);
    else commitTyped(typedText === null ? Number.NaN : by !== null ? value + by : read(typedText), { bounds, value, typing: typing.current, callbacks });
    typing.current = null;
    setDraft(null);
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => fieldKey(e, canceled, spin);
  return { draft, spin, spent, type, focus, leave, key };
}

/** Commit a typed `n`, or give back the value typing began from when `n` is no number. */
function commitTyped(
  n: number,
  { bounds, value, typing, callbacks: { onChange, onInput, onCancel } }: {
    bounds: Bounds;
    value: number;
    typing: Typing | null;
    callbacks: TypingCallbacks;
  },
): void {
  const next = settled(n, bounds);
  if (!Number.isNaN(next)) {
    // Against where typing began: a caller previewing through `onInput` already holds `next` as its value.
    if (next !== (typing?.from ?? value)) onChange(next);
  } else if (typing?.sent) {
    if (!Number.isNaN(typing.from)) onInput?.(typing.from);
    onCancel?.();
  }
}

/** Enter commits, Escape cancels, and an arrow steps; an input method's keys are its own. */
function fieldKey(e: KeyboardEvent<HTMLInputElement>, canceled: RefObject<boolean>, spin: (key: string) => boolean): void {
  if (imeKey(e.nativeEvent)) return;
  if (e.key === 'Enter') {
    e.currentTarget.blur();
  } else if (e.key === 'Escape') {
    canceled.current = true;
    e.currentTarget.blur();
  } else if (spin(e.key)) {
    e.preventDefault();
  }
}

/** What a pause in typing commits: a value `typed` reads as inside `bounds`, and never an offset, so a pause
 *  neither applies one twice nor clamps or reformats the text under the caret. */
function idleValue(typed: string | null, read: (text: string) => number, bounds: Bounds): number | null {
  if (typed === null || typed.trim() === '' || offsetIn(typed, read) !== null) return null;
  const n = read(typed);
  return Number.isNaN(n) || settled(n, bounds) !== n ? null : n;
}

/** What `typed` offsets by when it reads as `+=` or `-=` and a number: NaN
 *  when the number does not read, and null for text that is no offset. */
function offsetIn(typed: string, read: (text: string) => number): number | null {
  const m = /^\s*([+-])=\s*(.*)$/.exec(typed);
  if (!m) return null;
  const n = read(m[2]);
  return m[1] === '-' ? -n : n;
}
