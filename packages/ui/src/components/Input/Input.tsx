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
import { fieldClasses } from '../Field/Field';
import s from './Input.module.css';

/** Props for {@link Input}, on top of React Aria's `TextField` props. */
export type InputProps = Omit<RACTextFieldProps, 'children' | 'className'> & {
  label?: ReactNode;
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
    description,
    errorMessage,
    placeholder,
    leadingAdornment,
    trailingAdornment,
    className,
    ...textFieldProps
  } = props;

  return (
    <TextField {...textFieldProps} className={[s.field, fieldClasses.root, className].filter(Boolean).join(' ')}>
      {label !== undefined && <Label className={fieldClasses.label}>{label}</Label>}
      <div className={s.frame}>
        {leadingAdornment !== undefined && <span className={s.adornment}>{leadingAdornment}</span>}
        <RACInput ref={ref} placeholder={placeholder} />
        {trailingAdornment !== undefined && <span className={s.adornment}>{trailingAdornment}</span>}
      </div>
      {description !== undefined && (
        <Text slot="description" className={fieldClasses.hint}>
          {description}
        </Text>
      )}
      <FieldError className={fieldClasses.error}>{errorMessage}</FieldError>
    </TextField>
  );
});
