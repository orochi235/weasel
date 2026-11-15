import { useContext, useId, type ReactNode } from 'react';
import {
  RadioGroup as RACRadioGroup,
  Radio as RACRadio,
  Label,
  RadioGroupStateContext,
  type RadioGroupProps as RACRadioGroupProps,
  type RadioProps as RACRadioProps,
} from 'react-aria-components';
import { useRun } from '../Run';
import { slotClass, useRunSlot } from '../Along/runSlots';
import { fieldClasses } from '../Field/Field';
import { FieldFoot, type FieldSlotProps, type FieldStateProps } from '../Field/fieldSlots';
import { RadioGroupAlong, RadioSlotsContext } from './RadioGroupAlong';
import { useControlAccess, type HoldProps } from '../Disabled';
import { useRacHold } from '../Disabled/racHold';
import { useRacField } from '../Field/racField';
import s from './RadioGroup.module.css';

/** Props for {@link RadioGroup}, on top of React Aria's `RadioGroup` props. */
export type RadioGroupProps = Omit<RACRadioGroupProps, 'children' | 'className' | 'isDisabled' | 'isReadOnly' | 'isInvalid' | 'isRequired'> & Omit<FieldSlotProps, 'orientation'> & FieldStateProps & HoldProps & {
  children?: ReactNode;
  className?: string;
};

/**
 * A set of mutually exclusive choices, wrapping React Aria's RadioGroup and
 * supplying the same label / description / errorMessage slots as `Input`.
 * Holds {@link Radio} children. Inside an `Along` with a curved shape the label and radios lie along the shape, the
 * description and error one row further in, and `orientation` has nothing to choose.
 *
 * Inside a `Field`, and with no `label` or `aria-label` of its own, it takes the field's label, description and
 * error.
 */
export function RadioGroup(props: RadioGroupProps) {
  const enclosing = useRun();
  const { rest: { invalid, required, ...own }, rac, wrap } = useRacHold(props);
  const field = useRacField({ id: own.id, 'aria-label': own['aria-label'], 'aria-labelledby': own['aria-labelledby'], 'aria-describedby': rac['aria-describedby'], invalid, required, labeled: own.label !== undefined });
  if (enclosing.shape !== undefined && enclosing.shape.kind !== 'line') return wrap(<RadioGroupAlong {...own} {...rac} {...field} shape={enclosing.shape} align={enclosing.align ?? 'center'} />);
  const { label, description, errorMessage, children, className, ...rest } = own;
  return wrap(
    <RACRadioGroup
      {...rest}
      {...rac}
      {...field}
      className={[s.group, fieldClasses.root, className].filter(Boolean).join(' ')}
    >
      {label !== undefined && <Label className={s.legend}>{label}</Label>}
      {children}
      <FieldFoot description={description} errorMessage={errorMessage} />
    </RACRadioGroup>,
  );
}

/** Props for {@link Radio}, on top of React Aria's `Radio` props. */
export type RadioProps = Omit<RACRadioProps, 'className' | 'children' | 'isDisabled'> & {
  children?: ReactNode;
  className?: string;
  /** A note after the label, and the choice's accessible description. */
  description?: string;
  /** This choice cannot be taken. A `Disabled` or `ReadOnly` scope around the choice alone holds it the same way;
   *  hold the whole group with the group's own `disabled` or a scope around the group. */
  disabled?: boolean;
  /** Why the choice is disabled, in place of `description` while `disabled`. */
  disabledReason?: string;
};

/** One choice in a {@link RadioGroup}. The label is passed as children. */
export function Radio({ children, className, description, disabled: own, disabledReason, ...rest }: RadioProps) {
  const slot = useRunSlot(RadioSlotsContext, rest.value);
  const noteId = useId();
  const group = useContext(RadioGroupStateContext);
  const access = useControlAccess({ disabled: own, disabledReason });
  // A hold around the whole group already reached it through the group, which keeps a held-for-a-reason group reachable.
  const held = own === true || (access.state !== 'enabled' && !group?.isDisabled && !group?.isReadOnly);
  const disabled = held || undefined;
  const note = (held && access.reason) || description;
  const { className: _, style, ...at } = slot ?? {};
  return (
    <RACRadio
      {...rest}
      isDisabled={disabled}
      {...(note ? { 'aria-describedby': noteId } : {})}
      {...at}
      className={slotClass(slot, [s.radio, className].filter(Boolean).join(' '))}
      style={slot ? { ...(typeof rest.style === 'object' ? rest.style : null), ...style } : rest.style}
    >
      <span className={s.dot} />
      {children !== undefined && <span>{children}</span>}
      {note && <span id={noteId} aria-hidden="true" className={s.note}>{note}</span>}
    </RACRadio>
  );
}
