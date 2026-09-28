import { forwardRef, type ReactNode, type Ref } from 'react';
import {
  TextField,
  Label,
  Input as RACInput,
  Text,
  FieldError,
  type TextFieldProps as RACTextFieldProps,
  type ValidationResult,
} from 'react-aria-components';
import type { FieldOrientation } from '../Field/Field';
import f from '../field.module.css';
import s from './Input.module.css';

/** Props for {@link Input}, on top of React Aria's `TextField` props. */
export type InputProps = Omit<RACTextFieldProps, 'children' | 'className'> & {
  label?: ReactNode;
  /**
   * `'stacked'` (the default) puts the label above the field; `'row'` sets it
   * beside the field at its own width, with any description or error on a
   * line below. Same vocabulary as {@link Field}'s `orientation`.
   */
  orientation?: FieldOrientation;
  description?: ReactNode;
  errorMessage?: ReactNode | ((v: ValidationResult) => ReactNode);
  placeholder?: string;
  leadingAdornment?: ReactNode;
  trailingAdornment?: ReactNode;
  className?: string;
};

/**
 * Single-line text input wrapping React Aria's TextField. Supplies a
 * default skin against the `--wzl-*` token system, and exposes the
 * familiar label / description / errorMessage / adornment slot shape.
 *
 * `ref` forwards to the underlying `<input>`.
 */
export const Input = forwardRef(function Input(
  props: InputProps,
  ref: Ref<HTMLInputElement>,
) {
  const {
    label,
    orientation = 'stacked',
    description,
    errorMessage,
    placeholder,
    leadingAdornment,
    trailingAdornment,
    className,
    ...textFieldProps
  } = props;

  return (
    <TextField
      {...textFieldProps}
      className={[
        f.field,
        f.control,
        orientation === 'row' && f.row,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label !== undefined && <Label className={f.label}>{label}</Label>}
      <div className={`${f.frame} ${s.frame}`}>
        {leadingAdornment !== undefined && <span className={s.adornment}>{leadingAdornment}</span>}
        <RACInput ref={ref} placeholder={placeholder} />
        {trailingAdornment !== undefined && <span className={s.adornment}>{trailingAdornment}</span>}
      </div>
      {description !== undefined && (
        <Text slot="description" className={`${f.hint} ${f.below}`}>
          {description}
        </Text>
      )}
      <FieldError className={`${f.error} ${f.below}`}>{errorMessage}</FieldError>
    </TextField>
  );
});
