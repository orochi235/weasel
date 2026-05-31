import { forwardRef, type ReactNode, type Ref } from 'react';
import {
  Switch as RACSwitch,
  type SwitchProps as RACSwitchProps,
} from 'react-aria-components';
import s from './Switch.module.css';

export type SwitchProps = Omit<RACSwitchProps, 'children' | 'className'> & {
  children?: ReactNode;
  className?: string;
};

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
