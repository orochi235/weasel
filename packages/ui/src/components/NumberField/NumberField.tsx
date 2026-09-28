import { forwardRef, type ReactNode, type Ref } from 'react';
import {
  NumberField as RACNumberField,
  Label,
  Input as RACInput,
  Group,
  Button as RACButton,
  Text,
  FieldError,
  type NumberFieldProps as RACNumberFieldProps,
  type ValidationResult,
} from 'react-aria-components';
import type { FieldOrientation } from '../Field/Field';
import f from '../field.module.css';
import s from './NumberField.module.css';

/** Props for {@link NumberField}, on top of React Aria's `NumberField` props. */
export type NumberFieldProps = Omit<RACNumberFieldProps, 'children' | 'className'> & {
  label?: ReactNode;
  /**
   * `'stacked'` (the default) puts the label above the field; `'row'` sets it
   * beside the field at its own width, with any description or error on a
   * line below. Same vocabulary as {@link Field}'s `orientation`.
   */
  orientation?: FieldOrientation;
  description?: ReactNode;
  errorMessage?: ReactNode | ((v: ValidationResult) => ReactNode);
  /** Hide the up/down stepper buttons. Defaults to false. */
  hideSteppers?: boolean;
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
    orientation = 'stacked',
    description,
    errorMessage,
    hideSteppers,
    ghost,
    placeholder,
    width = 'fill',
    className,
    ...rest
  } = props;
  return (
    <RACNumberField
      {...rest}
      className={[
        f.field,
        f.control,
        width === 'fit' && `${f.fit} ${s.fit}`,
        orientation === 'row' && f.row,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label !== undefined && <Label className={f.label}>{label}</Label>}
      <Group className={[f.frame, s.frame, ghost && s.ghost].filter(Boolean).join(' ')}>
        <RACInput ref={ref} placeholder={placeholder} />
        {!hideSteppers && (
          <div className={s.steppers}>
            <RACButton slot="increment" className={s.stepper} aria-label="Increment">▲</RACButton>
            <RACButton slot="decrement" className={s.stepper} aria-label="Decrement">▼</RACButton>
          </div>
        )}
      </Group>
      {description !== undefined && (
        <Text slot="description" className={`${f.hint} ${f.below}`}>
          {description}
        </Text>
      )}
      <FieldError className={`${f.error} ${f.below}`}>{errorMessage}</FieldError>
    </RACNumberField>
  );
});
