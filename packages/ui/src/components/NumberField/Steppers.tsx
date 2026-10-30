import type { RefObject } from 'react';
import s from './NumberField.module.css';
import { useStepRepeat } from './useStepRepeat';

/** A `UnitField`'s up and down buttons: each steps once on a tap and repeats while held. `spin` steps by an
 *  arrow key's name, and `spent` says whether that key has nowhere left to step to. */
export function Steppers({ spin, spent, disabled, atMax, atMin }: {
  spin: RefObject<(key: string) => boolean>;
  spent: RefObject<(key: string) => boolean>;
  disabled: boolean;
  atMax: boolean;
  atMin: boolean;
}) {
  const repeat = useStepRepeat(spin, spent);
  const stepper = (key: 'ArrowUp' | 'ArrowDown', label: string, glyph: string, atBound: boolean) => (
    <Stepper
      label={label}
      glyph={glyph}
      disabled={atBound || disabled}
      onHold={() => repeat.start(key)}
      onRelease={repeat.stop}
      onTap={() => spin.current(key)}
    />
  );
  return (
    <div className={s.steppers}>
      {stepper('ArrowUp', 'Increment', '▲', atMax)}
      {stepper('ArrowDown', 'Decrement', '▼', atMin)}
    </div>
  );
}

interface StepperProps {
  label: string;
  glyph: string;
  disabled: boolean;
  onHold: () => void;
  onRelease: () => void;
  onTap: () => void;
}

function Stepper({ label, glyph, disabled, onHold, onRelease, onTap }: StepperProps) {
  return (
    <button
      type="button"
      className={s.stepper}
      data-wzl-subordinate=""
      aria-label={label}
      tabIndex={-1}
      disabled={disabled}
      // Keeps focus in the input, where a press on the button would take it.
      onPointerDown={(e) => {
        e.preventDefault();
        onHold();
      }}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
      // A click with no pointer down before it — assistive tech, or a test.
      onClick={(e) => {
        if (e.detail === 0) onTap();
      }}
    >
      {glyph}
    </button>
  );
}
