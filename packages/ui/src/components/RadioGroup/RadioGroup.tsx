import { useId, type ReactNode } from 'react';
import {
  RadioGroup as RACRadioGroup,
  Radio as RACRadio,
  Label,
  type RadioGroupProps as RACRadioGroupProps,
  type RadioProps as RACRadioProps,
} from 'react-aria-components';
import { useRun } from '../Run';
import { slotClass, useRunSlot } from '../Along/runSlots';
import { fieldClasses } from '../Field/Field';
import { FieldFoot, type FieldSlotProps } from '../Field/fieldSlots';
import { RadioGroupAlong, RadioSlotsContext } from './RadioGroupAlong';
import s from './RadioGroup.module.css';

/** Props for {@link RadioGroup}, on top of React Aria's `RadioGroup` props. */
export type RadioGroupProps = Omit<RACRadioGroupProps, 'children' | 'className'> & Omit<FieldSlotProps, 'orientation'> & {
  children?: ReactNode;
  className?: string;
};

/**
 * A set of mutually exclusive choices, wrapping React Aria's RadioGroup and
 * supplying the same label / description / errorMessage slots as `Input`.
 * Holds {@link Radio} children. Inside an `Along` with a curved shape the label and radios lie along the shape, the
 * description and error one row further in, and `orientation` has nothing to choose.
 */
export function RadioGroup(props: RadioGroupProps) {
  const enclosing = useRun();
  if (enclosing.shape !== undefined && enclosing.shape.kind !== 'line') return <RadioGroupAlong {...props} shape={enclosing.shape} align={enclosing.align ?? 'center'} />;
  const { label, description, errorMessage, children, className, ...rest } = props;
  return (
    <RACRadioGroup
      {...rest}
      className={[s.group, fieldClasses.root, className].filter(Boolean).join(' ')}
    >
      {label !== undefined && <Label className={s.legend}>{label}</Label>}
      {children}
      <FieldFoot description={description} errorMessage={errorMessage} />
    </RACRadioGroup>
  );
}

/** Props for {@link Radio}, on top of React Aria's `Radio` props. */
export type RadioProps = Omit<RACRadioProps, 'className' | 'children'> & {
  children?: ReactNode;
  className?: string;
  /** A note after the label, and the choice's accessible description. */
  description?: string;
  /** Why the choice is disabled, in place of `description` while `isDisabled`. */
  disabledReason?: string;
};

/** One choice in a {@link RadioGroup}. The label is passed as children. */
export function Radio({ children, className, description, disabledReason, ...rest }: RadioProps) {
  const slot = useRunSlot(RadioSlotsContext, rest.value);
  const noteId = useId();
  const note = (rest.isDisabled && disabledReason) || description;
  const { className: _, style, ...at } = slot ?? {};
  return (
    <RACRadio
      {...rest}
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
