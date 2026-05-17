import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import s from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md';

type ButtonBase = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  children?: ReactNode;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
};

type ButtonRegular = ButtonBase & {
  iconOnly?: false;
  ariaLabel?: string;
};

type ButtonIconOnly = ButtonBase & {
  iconOnly: true;
  ariaLabel: string;
};

export type ButtonProps = ButtonRegular | ButtonIconOnly;

function Spinner(): ReactNode {
  return (
    <span className={s.spinner} aria-hidden="true">
      <svg viewBox="0 0 16 16" width="14" height="14">
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeOpacity="0.25"
        />
        <path
          d="M 8 2 A 6 6 0 0 1 14 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export const Button = forwardRef(function Button(
  props: ButtonProps,
  ref: Ref<HTMLButtonElement>,
) {
  const {
    variant = 'secondary',
    size = 'md',
    disabled,
    loading,
    leadingIcon,
    trailingIcon,
    fullWidth,
    iconOnly,
    ariaLabel,
    type = 'button',
    className,
    children,
    onClick,
  } = props;

  const cls = [
    s.button,
    s[`variant_${variant}`],
    s[`size_${size}`],
    fullWidth && s.fullWidth,
    iconOnly && s.iconOnly,
    loading && s.loading,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const showLeading = !iconOnly && (loading || leadingIcon);

  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      disabled={disabled}
      aria-busy={loading ? true : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {showLeading && (
        <span className={s.iconSlot}>{loading ? <Spinner /> : leadingIcon}</span>
      )}
      {iconOnly ? (
        loading ? <Spinner /> : <span className={s.iconSlot}>{children}</span>
      ) : (
        children !== undefined && <span className={s.label}>{children}</span>
      )}
      {!iconOnly && trailingIcon && (
        <span className={s.iconSlot}>{trailingIcon}</span>
      )}
    </button>
  );
});
