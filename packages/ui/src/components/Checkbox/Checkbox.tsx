import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type FocusEventHandler,
  type ReactNode,
  type Ref,
} from 'react';
import shared from './box.module.css';
import s from './Checkbox.module.css';
import type { HoldProps } from '../Disabled';
import { useNativeHold } from '../Disabled/nativeHold';

/** Props for {@link Checkbox}. The label is passed as children. */
export type CheckboxProps = HoldProps & {
  children?: ReactNode;
  className?: string;
  /** Controlled selection. */
  isSelected?: boolean;
  /** Initial selection when uncontrolled. */
  defaultSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  /** Draws the mixed mark; the input's `indeterminate` is set to match. */
  isIndeterminate?: boolean;
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
    disabled,
    disabledReason,
    readOnly,
    readOnlyReason,
    isInvalid,
    isRequired,
    ...rest
  } = props;
  const hold = useNativeHold({ disabled, disabledReason, readOnly, readOnlyReason, 'aria-describedby': rest['aria-describedby'] });
  const [uncontrolled, setUncontrolled] = useState(defaultSelected);
  const checked = isSelected ?? uncontrolled;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = isIndeterminate;
  });
  return hold.wrap(
    <label
      ref={ref}
      className={[s.checkbox, className].filter(Boolean).join(' ')}
      data-disabled={hold.access.state === 'disabled' || undefined}
    >
      <input
        {...rest}
        ref={input}
        type="checkbox"
        className={shared.checkbox}
        checked={checked}
        {...hold.attrs}
        data-disabled={undefined}
        required={isRequired}
        aria-invalid={isInvalid || undefined}
        onChange={(e) => {
          // A click clears `indeterminate`, and the effect only puts it back if something renders.
          e.target.indeterminate = isIndeterminate;
          if (hold.refuses) return;
          if (isSelected === undefined) setUncontrolled(e.target.checked);
          onChange?.(e.target.checked);
        }}
      />
      {children !== undefined && <span className={s.label}>{children}</span>}
    </label>,
  );
});
