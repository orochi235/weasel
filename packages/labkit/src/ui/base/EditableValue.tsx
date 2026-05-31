import { useEffect, useState } from 'react';
import { formatNumber, parseSignedNumber } from '../format';
import { cn } from './cn';

export interface EditableValueProps {
  value: number;
  onCommit: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

/**
 * Badge-styled number input. Displays negatives with an en dash; accepts
 * either hyphen-minus or en dash on input. Commits on Enter or blur
 * (clamped to min/max); Escape reverts to the last committed value.
 */
export function EditableValue({ value, onCommit, min, max, step, className }: EditableValueProps) {
  const [draft, setDraft] = useState(() => formatNumber(value));

  useEffect(() => {
    setDraft(formatNumber(value));
  }, [value]);

  const commit = () => {
    const n = parseSignedNumber(draft);
    if (!Number.isFinite(n)) {
      setDraft(formatNumber(value));
      return;
    }
    const lo = min ?? Number.NEGATIVE_INFINITY;
    const hi = max ?? Number.POSITIVE_INFINITY;
    const clamped = Math.min(hi, Math.max(lo, n));
    setDraft(formatNumber(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className={cn('lk-editable-value', className)}
      value={draft}
      size={Math.max(1, draft.length)}
      step={step}
      onChange={(e) => setDraft(e.target.value.replace(/-/g, '−'))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setDraft(formatNumber(value));
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
}
