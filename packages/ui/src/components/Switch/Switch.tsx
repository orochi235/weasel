import { forwardRef, useRef, type ReactNode, type Ref } from 'react';
import {
  Switch as RACSwitch,
  type SwitchProps as RACSwitchProps,
} from 'react-aria-components';
import type { HoldProps } from '../Disabled';
import { useRacHold } from '../Disabled/racHold';
import { useFieldControl } from '../Field/fieldSemantics';
import { modifiersOf, type ToggleModifiers } from '../toggleModifiers';
import s from './Switch.module.css';

/**
 * Props for {@link Switch}, on top of React Aria's `Switch` props. The label
 * is passed as children.
 */
export type SwitchProps = Omit<RACSwitchProps, 'children' | 'className' | 'isDisabled' | 'isReadOnly' | 'onChange'> & HoldProps & {
  children?: ReactNode;
  /** Called with the new state and the keys held as it changed, so a list of switches can solo on Alt. */
  onChange?: (isSelected: boolean, modifiers: ToggleModifiers) => void;
  className?: string;
  /** Receives the `<label>` the switch is drawn in. `ref` reaches the `<input>`. */
  rootRef?: Ref<HTMLLabelElement>;
};

/**
 * On/off toggle wrapping React Aria's Switch, skinned against the `--wzl-*`
 * tokens. Use for a setting that takes effect immediately; use `Checkbox`
 * for one that is submitted with a form.
 *
 * With no children and no `aria-label`, it takes its name, description and
 * error from a `Field` around it.
 *
 * `ref` forwards to the `<input>`; `rootRef` to the `<label>`.
 */
export const Switch = forwardRef(function Switch(
  props: SwitchProps,
  ref: Ref<HTMLInputElement>,
) {
  const { rest: { children, className, rootRef, onChange, onClickCapture, ...rest }, rac, wrap } = useRacHold(props);
  // React Aria reports the new state alone; the click that changes it passes the label first, carrying its keys.
  const mods = useRef<ToggleModifiers>(modifiersOf(undefined));
  // A switch has no invalid state to show, so the field's error only describes it.
  const { 'aria-invalid': _invalid, ...field } = useFieldControl({ ...rest, 'aria-describedby': rac['aria-describedby'], labeled: children !== undefined });
  return wrap(
    <RACSwitch
      {...rest}
      {...rac}
      {...field}
      ref={rootRef}
      inputRef={ref}
      onClickCapture={(e) => {
        mods.current = modifiersOf(e);
        onClickCapture?.(e);
      }}
      onChange={(on) => {
        onChange?.(on, mods.current);
        mods.current = modifiersOf(undefined);
      }}
      className={[s.switch, className].filter(Boolean).join(' ')}
    >
      <span className={s.track}>
        <span className={s.thumb} />
      </span>
      {children !== undefined && <span className={s.label}>{children}</span>}
    </RACSwitch>,
  );
});
