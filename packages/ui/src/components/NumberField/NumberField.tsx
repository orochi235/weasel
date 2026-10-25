import { forwardRef, type Ref } from 'react';
import {
  NumberField as RACNumberField,
  Label,
  Input as RACInput,
  Group,
  Button as RACButton,
  type NumberFieldProps as RACNumberFieldProps,
} from 'react-aria-components';
import { FieldFoot, fieldRootClass, type FieldSlotProps } from '../Field/fieldSlots';
import type { StepperSide } from './UnitField';
import f from '../field.module.css';
import s from './NumberField.module.css';

/** Props for {@link NumberField}, on top of React Aria's `NumberField` props. */
export type NumberFieldProps = Omit<RACNumberFieldProps, 'children' | 'className'> & FieldSlotProps & {
  /** Hide the up/down stepper buttons. Defaults to false. */
  hideSteppers?: boolean;
  /** Which end of the field the steppers sit at. Defaults to `'start'`. */
  stepperSide?: StepperSide;
  /** Render with no box until focused — the readout treatment the property
   *  rows use, for a value that sits inside other chrome rather than in a form. */
  ghost?: boolean;
  /** Native input placeholder — e.g. `'Mixed'` for a multi-selection
   *  editor with no shared value. */
  placeholder?: string;
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
 * `ref` forwards to the underlying `<input>`.
 */
export const NumberField = forwardRef(function NumberField(
  props: NumberFieldProps,
  ref: Ref<HTMLInputElement>,
) {
  const {
    label,
    orientation,
    description,
    errorMessage,
    hideSteppers,
    stepperSide = 'start',
    ghost,
    placeholder,
    width = 'fill',
    className,
    ...rest
  } = props;
  return (
    <RACNumberField
      {...rest}
      className={fieldRootClass({ orientation, width, fit: s.fit, className })}
    >
      {label !== undefined && <Label className={f.label}>{label}</Label>}
      <Group
        className={[f.frame, s.frame, ghost && s.ghost].filter(Boolean).join(' ')}
        data-stepper-side={stepperSide}
      >
        <RACInput ref={ref} placeholder={placeholder} />
        {!hideSteppers && (
          <div className={s.steppers}>
            <RACButton slot="increment" className={s.stepper} aria-label="Increment" data-wzl-subordinate="">▲</RACButton>
            <RACButton slot="decrement" className={s.stepper} aria-label="Decrement" data-wzl-subordinate="">▼</RACButton>
          </div>
        )}
      </Group>
      <FieldFoot description={description} errorMessage={errorMessage} />
    </RACNumberField>
  );
});
