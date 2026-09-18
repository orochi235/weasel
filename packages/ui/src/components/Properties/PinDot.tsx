import type { ReactNode } from 'react';
import s from './Properties.module.css';

export interface PinDotProps {
  /** Whether the row is currently auto. */
  auto: boolean;
  /** The row's label, used to name the control. */
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
  const toggle = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    // The wrapping <label> would otherwise actuate the row's control.
    e.preventDefault();
    e.stopPropagation();
    onChange(!auto);
  };
  return (
    // A span, not a button: a <button> is a labelable element, so inside the
    // row's <label> it would take the row's name off the actual control.
    <span
      role="button"
      tabIndex={0}
      className={auto ? `${s.pin} ${s.pinAuto}` : s.pin}
      // The name stays put and `aria-pressed` carries the state, so a voice
      // control user has something stable to say. Pressed means pinned, to
      // match the name.
      aria-pressed={!auto}
      aria-label={`Pin ${name}`}
      onClick={toggle}
      onKeyDown={(e) => {
        // A native button gives Enter and Space for free; a span gives neither,
        // and Space would scroll the panel.
        if (e.key === 'Enter' || e.key === ' ') toggle(e);
      }}
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}
