import type { ReactNode } from 'react';
import {
  RadioGroup as RACRadioGroup,
  Radio as RACRadio,
  Label,
  type RadioGroupProps as RACRadioGroupProps,
  type RadioProps as RACRadioProps,
} from 'react-aria-components';
import { useTrackShape } from '../Along/alongContext';
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
  const along = useTrackShape();
  if (along !== null && along.shape.kind !== 'line') return <RadioGroupAlong {...props} shape={along.shape} align={along.align} />;
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
};

/** One choice in a {@link RadioGroup}. The label is passed as children. */
export function Radio({ children, className, ...rest }: RadioProps) {
  const slot = useRunSlot(RadioSlotsContext, rest.value);
  const { className: _, style, ...at } = slot ?? {};
  return (
    <RACRadio
      {...rest}
      {...at}
      className={slotClass(slot, [s.radio, className].filter(Boolean).join(' '))}
      style={slot ? { ...(typeof rest.style === 'object' ? rest.style : null), ...style } : rest.style}
    >
      <span className={s.dot} />
      {children !== undefined && <span>{children}</span>}
    </RACRadio>
  );
}
