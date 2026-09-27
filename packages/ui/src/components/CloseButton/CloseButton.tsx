import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Icon } from '../../icons/Icon';
import { SegmentTooltip } from '../segmentTooltip';
import s from './CloseButton.module.css';

/** Props for {@link CloseButton}. */
export interface CloseButtonProps {
  /** Accessible name — what the press closes or removes: `Close dialog`,
   *  `Remove Glow`. Required, since the button shows only a glyph. */
  ariaLabel: string;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  /** Kit tooltip content. None by default. */
  tooltip?: ReactNode;
  disabled?: boolean;
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
  { ariaLabel, onClick, tooltip, disabled, className }: CloseButtonProps,
  ref: Ref<HTMLButtonElement>,
) {
  return (
    <SegmentTooltip content={tooltip} disabled={disabled}>
      <button
        ref={ref}
        type="button"
        className={className ? `${s.close} ${className}` : s.close}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon name="close" size={16} />
      </button>
    </SegmentTooltip>
  );
});
