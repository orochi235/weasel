import { forwardRef, type ReactNode, type Ref } from 'react';
import {
  TextField,
  Label,
  Input as RACInput,
  type TextFieldProps as RACTextFieldProps,
} from 'react-aria-components';
import { FieldFoot, fieldRootClass, type FieldSlotProps } from '../Field/fieldSlots';
import f from '../field.module.css';
import s from './Input.module.css';

/** Props for {@link Input}, on top of React Aria's `TextField` props. */
export type InputProps = Omit<RACTextFieldProps, 'children' | 'className'> & FieldSlotProps & {
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
    orientation,
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
      className={fieldRootClass({ orientation, className })}
    >
      {label !== undefined && <Label className={f.label}>{label}</Label>}
      <div className={`${f.frame} ${s.frame}`}>
        {leadingAdornment !== undefined && <span className={s.adornment} data-wzl-subordinate="">{leadingAdornment}</span>}
        <RACInput ref={ref} placeholder={placeholder} />
        {trailingAdornment !== undefined && <span className={s.adornment} data-wzl-subordinate="">{trailingAdornment}</span>}
      </div>
      <FieldFoot description={description} errorMessage={errorMessage} />
    </TextField>
  );
});
