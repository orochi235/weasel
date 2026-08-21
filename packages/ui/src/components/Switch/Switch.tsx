import { forwardRef, type ReactNode, type Ref } from 'react';
import {
  Switch as RACSwitch,
  type SwitchProps as RACSwitchProps,
} from 'react-aria-components';
import s from './Switch.module.css';

/**
 * Props for {@link Switch}, on top of React Aria's `Switch` props. The label
 * is passed as children.
 */
export type SwitchProps = Omit<RACSwitchProps, 'children' | 'className'> & {
  children?: ReactNode;
  className?: string;
};

/**
 * On/off toggle wrapping React Aria's Switch, skinned against the `--wzl-*`
 * tokens. Use for a setting that takes effect immediately; use `Checkbox`
 * for one that is submitted with a form.
 *
 * `ref` forwards to the underlying label element.
 */
export const Switch = forwardRef(function Switch(
  props: SwitchProps,
  ref: Ref<HTMLLabelElement>,
) {
  const { children, className, ...rest } = props;
  return (
    <RACSwitch
      {...rest}
      ref={ref}
      className={[s.switch, className].filter(Boolean).join(' ')}
    >
      <span className={s.track}>
        <span className={s.thumb} />
      </span>
      {children !== undefined && <span className={s.label}>{children}</span>}
    </RACSwitch>
  );
});
