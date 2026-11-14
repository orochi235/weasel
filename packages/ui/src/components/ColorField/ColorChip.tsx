import { useState, type InputHTMLAttributes, type ReactElement } from 'react';
import { useRecordRecentColor } from '../RecentColors/RecentColorsProvider';
import { usePickerClose } from './usePickerClose';

/** What a commit hands the recent colors: the color(s) applied, or nothing to record the pick itself. */
export type AppliedColor = string | readonly string[] | void;

/** Records what a commit applied, else what was picked, into the nearest recent-colors store. */
export function useRecordApplied(): (applied: AppliedColor, picked: string) => void {
  const record = useRecordRecentColor();
  return (applied, picked) => record(applied ?? picked);
}

/** Props for {@link ColorChip}. */
export interface ColorChipProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onInput' | 'onChange' | 'onBlur'> {
  /** The color shown while no pick is under way, `#rrggbb`. */
  value: string;
  /** Every tick of the picker, as `#rrggbb`. */
  onInput?: (rgb: string) => void;
  /** Once when the picker closes or the chip loses focus, if the pick moved. Return the color actually applied
   *  when it differs from the pick, and the recent colors record that instead. */
  onChange: (rgb: string) => AppliedColor;
  /** Drop every pick: the chip is disabled or read-only. */
  refuses?: boolean;
}

/**
 * The native color input every kit picker opens: it holds the pick through a gesture, commits once when the
 * picker closes (or on blur), and records what was applied in the recent colors. `ColorField` draws one, and so
 * does every paint editor built on it.
 */
export function ColorChip(
  { value, onInput, onChange, refuses = false, onClick, ...input }: ColorChipProps,
): ReactElement {
  // Tracks the picker through a pick; the prop only catches up on commit.
  const [draft, setDraft] = useState<string | null>(null);
  const recordApplied = useRecordApplied();
  const commit = (): void => {
    if (draft === null) return;
    setDraft(null);
    recordApplied(onChange(draft), draft);
  };
  const picker = usePickerClose(commit);

  return (
    <input
      {...input}
      ref={picker}
      type="color"
      value={draft ?? value}
      onClick={refuses ? (e) => e.preventDefault() : onClick}
      onInput={(e) => {
        if (refuses) return;
        const rgb = (e.target as HTMLInputElement).value;
        setDraft(rgb);
        onInput?.(rgb);
      }}
      onBlur={commit}
    />
  );
}
