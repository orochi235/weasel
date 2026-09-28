import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type FocusEventHandler,
  type ReactNode,
  type Ref,
} from 'react';
import shared from '../checkbox.module.css';
import s from './Checkbox.module.css';

/** Props for {@link Checkbox}. The label is passed as children. */
export type CheckboxProps = {
  children?: ReactNode;
  className?: string;
  /** Controlled selection. */
  isSelected?: boolean;
  /** Initial selection when uncontrolled. */
  defaultSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  /** Draws the mixed mark; the input's `indeterminate` is set to match. */
  isIndeterminate?: boolean;
  isDisabled?: boolean;
  /** Focusable and announced, but a click does not change it. */
  isReadOnly?: boolean;
  isInvalid?: boolean;
  isRequired?: boolean;
  name?: string;
  value?: string;
  id?: string;
  autoFocus?: boolean;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
};

/**
 * Single checkbox: a native `<input type="checkbox">` inside a `<label>`, the
 * box drawn by the shared checkbox skin. Supports indeterminate via
 * `isIndeterminate`. The label is supplied as children.
 */
export const Checkbox = forwardRef(function Checkbox(
  props: CheckboxProps,
  ref: Ref<HTMLLabelElement>,
) {
  const {
    children,
    className,
    isSelected,
    defaultSelected = false,
    onChange,
    isIndeterminate = false,
    isDisabled,
    isReadOnly,
    isInvalid,
    isRequired,
    ...rest
  } = props;
  const [uncontrolled, setUncontrolled] = useState(defaultSelected);
  const checked = isSelected ?? uncontrolled;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = isIndeterminate;
  });
  return (
    <label
      ref={ref}
      className={[s.checkbox, className].filter(Boolean).join(' ')}
      data-disabled={isDisabled || undefined}
    >
      <input
        {...rest}
        ref={input}
        type="checkbox"
        className={shared.checkbox}
        checked={checked}
        disabled={isDisabled}
        required={isRequired}
        aria-invalid={isInvalid || undefined}
        aria-readonly={isReadOnly || undefined}
        onChange={(e) => {
          if (isReadOnly) return;
          if (isSelected === undefined) setUncontrolled(e.target.checked);
          onChange?.(e.target.checked);
        }}
      />
      {children !== undefined && <span className={s.label}>{children}</span>}
    </label>
  );
});
