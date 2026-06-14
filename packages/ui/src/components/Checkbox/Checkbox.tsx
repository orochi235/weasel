import { forwardRef, type ReactNode, type Ref } from 'react';
import {
  Checkbox as RACCheckbox,
  type CheckboxProps as RACCheckboxProps,
} from 'react-aria-components';
import s from './Checkbox.module.css';

export type CheckboxProps = Omit<RACCheckboxProps, 'children' | 'className'> & {
  children?: ReactNode;
  className?: string;
};

/**
 * Single checkbox wrapping React Aria's Checkbox. Supports indeterminate
 * via `isIndeterminate`. The label is supplied as children.
 */
export const Checkbox = forwardRef(function Checkbox(
  props: CheckboxProps,
  ref: Ref<HTMLLabelElement>,
) {
  const { children, className, ...rest } = props;
  return (
    <RACCheckbox
      {...rest}
      ref={ref}
      className={[s.checkbox, className].filter(Boolean).join(' ')}
    >
      {({ isIndeterminate }) => (
        <>
          <span className={s.box}>
            <svg className={s.checkmark} viewBox="0 0 14 14" aria-hidden="true">
              {isIndeterminate ? (
                <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <polyline
                  points="3,7.5 6,10.5 11,4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </span>
          {children !== undefined && <span className={s.label}>{children}</span>}
        </>
      )}
    </RACCheckbox>
  );
});
