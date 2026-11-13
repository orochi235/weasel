import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Icon } from '../../icons/Icon';
import { SegmentTooltip, segmentTooltipContent } from '../segmentTooltip';
import s from './CloseButton.module.css';
import { icon } from '../../icons.gen';

/** Props for {@link CloseButton}. */
export interface CloseButtonProps {
  /** Accessible name — what the press closes or removes: `Close dialog`,
   *  `Remove Glow`. Required, since the button shows only a glyph. */
  'aria-label': string;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  /** Kit tooltip content. None by default. */
  tooltip?: ReactNode;
  disabled?: boolean;
  /** Why it is disabled. Given, a disabled one keeps its tooltip, which reads the reason after its name, stays
   *  focusable, and gives the reason to assistive tech as its description; without one it is natively disabled. */
  disabledReason?: string;
  className?: string;
}

/**
 * The kit's close / dismiss / remove button: the `close` glyph at chrome size
 * in a square `--wzl-icon-button-size` target. Kit components that dismiss a
 * surface or remove a row draw their × with this.
 *
 * `ref` forwards to the underlying `<button>`.
 */
export const CloseButton = forwardRef(function CloseButton(
  { 'aria-label': ariaLabel, onClick, tooltip, disabled, disabledReason, className }: CloseButtonProps,
  ref: Ref<HTMLButtonElement>,
) {
  return (
    <SegmentTooltip
      content={segmentTooltipContent({ tooltip, ariaLabel, disabled, disabledReason })}
      disabled={disabled}
      disabledReason={disabledReason}
    >
      <button
        ref={ref}
        type="button"
        className={className ? `${s.close} ${className}` : s.close}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon name={icon('close')} size={16} />
      </button>
    </SegmentTooltip>
  );
});
