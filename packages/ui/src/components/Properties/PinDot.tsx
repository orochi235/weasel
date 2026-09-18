import type { ReactNode } from 'react';
import s from './Properties.module.css';

export interface PinDotProps {
  /** Whether the row is currently auto. */
  auto: boolean;
  /** The row's label, used to name the button. */
  label: ReactNode;
  onChange: (next: boolean) => void;
}

/**
 * Pinned/auto affordance for a property row. Filled means the row holds a
 * pinned value; hollow means it is auto and the owner decides.
 *
 * Invisible at rest and revealed by the row's `:hover` / `:focus-within` — so
 * tabbing to the row's control brings it into view and into reach, which is
 * the whole keyboard path for going auto.
 */
export function PinDot({ auto, label, onChange }: PinDotProps) {
  const name = typeof label === 'string' ? label : 'this setting';
  return (
    <button
      type="button"
      className={auto ? `${s.pin} ${s.pinAuto}` : s.pin}
      aria-pressed={auto}
      aria-label={`${name}: ${auto ? 'auto' : 'pinned'}`}
      onClick={(e) => {
        // The wrapping <label> would otherwise actuate the row's control.
        e.preventDefault();
        e.stopPropagation();
        onChange(!auto);
      }}
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}
