import type { KeyboardEvent, MouseEvent } from 'react';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';
import { Focusable, Tooltip, TooltipTrigger } from '../Tooltip';
import s from './Properties.module.css';

/** Props for {@link ResetControl}. */
export interface ResetControlProps {
  /** What it resets, as its name reads: `Reset Size`. */
  name: string;
  /** Put it back as its schema says. */
  onReset: () => void;
  /** Nothing to reset: drawn, and takes no press. */
  disabled?: boolean;
  className?: string;
}

/**
 * The one control that resets a setting, a row's or a group's: a small reset glyph, named `Reset <name>`.
 * A span with a button's role and keys, not a `<button>`: inside a row's `<label>` a button would take the
 * row's name off its control, and a press on it would reach that control.
 */
export function ResetControl({ name, onReset, disabled = false, className }: ResetControlProps) {
  const press = (e: MouseEvent | KeyboardEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) onReset();
  };
  return (
    <TooltipTrigger>
      <Focusable isDisabled={disabled}>
        <span
          role="button"
          tabIndex={disabled ? undefined : 0}
          aria-label={`Reset ${name}`}
          aria-disabled={disabled || undefined}
          className={[s.reset, className].filter(Boolean).join(' ')}
          onClick={press}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') press(e);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Icon name={icon('reset')} size={12} />
        </span>
      </Focusable>
      <Tooltip>{`Reset ${name}`}</Tooltip>
    </TooltipTrigger>
  );
}
