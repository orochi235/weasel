import { forwardRef, type Ref } from 'react';
import {
  NumberField as RACNumberField,
  Label,
  Input as RACInput,
  Group,
  Button as RACButton,
  type NumberFieldProps as RACNumberFieldProps,
} from 'react-aria-components';
import { MIXED_HINT } from '../Field/mixedHint';
import { FieldFoot, fieldRootClass, type FieldSlotProps } from '../Field/fieldSlots';
import type { StepperSide } from './UnitField';
import type { HoldProps } from '../Disabled';
import { useRacHold } from '../Disabled/racHold';
import type { ControlSizeProps } from '../ControlSize';
import { useFieldSizeClass } from '../Field/fieldSize';
import { useRacField } from '../Field/racField';
import f from '../Field/Field.module.css';
import s from './NumberField.module.css';

/** Props for {@link NumberField}, on top of React Aria's `NumberField` props. */
export type NumberFieldProps = Omit<RACNumberFieldProps, 'children' | 'className' | 'isDisabled' | 'isReadOnly'> & FieldSlotProps & HoldProps & ControlSizeProps & {
  /** Hide the up/down stepper buttons. Defaults to false. */
  hideSteppers?: boolean;
  /** Which end of the field the steppers sit at. Defaults to `'start'`. */
  stepperSide?: StepperSide;
  /** Render with no box until focused — the readout treatment the property
   *  rows use, for a value that sits inside other chrome rather than in a form. */
  ghost?: boolean;
  /** Native input placeholder. */
  placeholder?: string;
  /** The field stands for several values that differ: it shows empty, reading
   *  `Mixed` in place of `placeholder`. */
  mixed?: boolean;
  /**
   * `'fill'` (the default) takes the width of whatever row the field sits in.
   * `'fit'` sizes it to `--wzl-number-field-width` (`9ch` by default) plus its
   * own chrome, rather than to the input's 20-character intrinsic width.
   */
  width?: 'fill' | 'fit';
  className?: string;
};

/**
 * Numeric input with stepper buttons, wrapping React Aria's NumberField and
 * supplying the same label / description / errorMessage slots as `Input`.
 * Arrow keys and scroll step the value; parsing and formatting are React
 * Aria's.
 *
 * Inside a `Field`, and with no `label` or `aria-label` of its own, it takes the
 * field's label, description and error.
 *
 * `ref` forwards to the underlying `<input>`.
 */
export const NumberField = forwardRef(function NumberField(
  props: NumberFieldProps,
  ref: Ref<HTMLInputElement>,
) {
  const hold = useRacHold(props);
  const {
    label,
    orientation,
    description,
    errorMessage,
    hideSteppers,
    stepperSide = 'start',
    ghost,
    placeholder,
    mixed,
    width = 'fill',
    className,
    size,
    ...rest
  } = hold.rest;
  const sized = useFieldSizeClass(size, className);
  const field = useRacField({ id: rest.id, 'aria-label': rest['aria-label'], 'aria-labelledby': rest['aria-labelledby'], 'aria-describedby': hold.rac['aria-describedby'], isInvalid: rest.isInvalid, labeled: label !== undefined });
  return hold.wrap(
    <RACNumberField
      {...rest}
      {...hold.rac}
      {...field}
      value={mixed ? NaN : rest.value}
      className={fieldRootClass({ orientation, width, fit: s.fit, className: sized })}
    >
      {label !== undefined && <Label className={f.label}>{label}</Label>}
      <Group
        className={[f.frame, s.frame, ghost && s.ghost].filter(Boolean).join(' ')}
        data-stepper-side={stepperSide}
      >
        <RACInput ref={ref} placeholder={mixed ? MIXED_HINT : placeholder} />
        {!hideSteppers && (
          <div className={s.steppers}>
            <RACButton slot="increment" className={s.stepper} aria-label="Increment" data-wzl-subordinate="">▲</RACButton>
            <RACButton slot="decrement" className={s.stepper} aria-label="Decrement" data-wzl-subordinate="">▼</RACButton>
          </div>
        )}
      </Group>
      <FieldFoot description={description} errorMessage={errorMessage} />
    </RACNumberField>,
  );
});
