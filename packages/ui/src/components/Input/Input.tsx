import { forwardRef, type ReactNode, type Ref } from 'react';
import {
  TextField,
  Label,
  Input as RACInput,
  type TextFieldProps as RACTextFieldProps,
} from 'react-aria-components';
import { MIXED_HINT } from '../mixedHint';
import { FieldFoot, fieldRootClass, type FieldSlotProps } from '../Field/fieldSlots';
import f from '../field.module.css';
import s from './Input.module.css';

/** Props for {@link Input}, on top of React Aria's `TextField` props. */
export type InputProps = Omit<RACTextFieldProps, 'children' | 'className' | 'spellCheck'> & FieldSlotProps & {
  /** Whether the browser checks the text's spelling, as on a native `<input>`. */
  spellCheck?: boolean | 'true' | 'false';
  placeholder?: string;
  /** The field stands for several values that differ: it reads `Mixed` in
   *  place of `placeholder` while its value is empty. */
  mixed?: boolean;
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
    mixed,
    leadingAdornment,
    trailingAdornment,
    className,
    spellCheck,
    ...textFieldProps
  } = props;

  return (
    <TextField
      {...textFieldProps}
      spellCheck={spellCheck === undefined ? undefined : String(spellCheck)}
      className={fieldRootClass({ orientation, className })}
    >
      {label !== undefined && <Label className={f.label}>{label}</Label>}
      <div className={`${f.frame} ${s.frame}`}>
        {leadingAdornment !== undefined && <span className={s.adornment} data-wzl-subordinate="">{leadingAdornment}</span>}
        <RACInput ref={ref} placeholder={mixed ? MIXED_HINT : placeholder} />
        {trailingAdornment !== undefined && <span className={s.adornment} data-wzl-subordinate="">{trailingAdornment}</span>}
      </div>
      <FieldFoot description={description} errorMessage={errorMessage} />
    </TextField>
  );
});
