import { forwardRef, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import {
  TextField,
  Label,
  Input as RACInput,
  type TextFieldProps as RACTextFieldProps,
} from 'react-aria-components';
import { MIXED_HINT } from '../Field/mixedHint';
import { FieldFoot, fieldRootClass, type FieldSlotProps, type FieldStateProps } from '../Field/fieldSlots';
import type { HoldProps } from '../Disabled';
import { useRacHold } from '../Disabled/racHold';
import type { ControlSizeProps } from '../ControlSize';
import { useFieldSizeClass } from '../Field/fieldSize';
import { useRacField } from '../Field/racField';
import f from '../Field/Field.module.css';
import s from './Input.module.css';

/** Props for {@link Input}, on top of React Aria's `TextField` props. */
export type InputProps = Omit<RACTextFieldProps, 'children' | 'className' | 'spellCheck' | 'isDisabled' | 'isReadOnly' | 'isInvalid' | 'isRequired'> & FieldSlotProps & FieldStateProps & HoldProps & ControlSizeProps & {
  /** Whether the browser checks the text's spelling, as on a native `<input>`. */
  spellCheck?: boolean | 'true' | 'false';
  /** The label on a virtual keyboard's enter key, as on a native `<input>`. */
  enterKeyHint?: InputHTMLAttributes<HTMLInputElement>['enterKeyHint'];
  /** Whether and how typed text is capitalized, as on a native `<input>`. */
  autoCapitalize?: InputHTMLAttributes<HTMLInputElement>['autoCapitalize'];
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
 * Inside a `Field`, and with no `label` or `aria-label` of its own, it takes the
 * field's label, description and error.
 *
 * `ref` forwards to the underlying `<input>`.
 */
export const Input = forwardRef(function Input(
  props: InputProps,
  ref: Ref<HTMLInputElement>,
) {
  const hold = useRacHold(props);
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
    enterKeyHint,
    autoCapitalize,
    size,
    invalid,
    required,
    ...textFieldProps
  } = hold.rest;
  const sized = useFieldSizeClass(size, className);
  const field = useRacField({ id: textFieldProps.id, 'aria-label': textFieldProps['aria-label'], 'aria-labelledby': textFieldProps['aria-labelledby'], 'aria-describedby': hold.rac['aria-describedby'], invalid, required, labeled: label !== undefined });

  return hold.wrap(
    <TextField
      {...textFieldProps}
      {...hold.rac}
      {...field}
      spellCheck={spellCheck === undefined ? undefined : String(spellCheck)}
      className={fieldRootClass({ orientation, className: sized })}
    >
      {label !== undefined && <Label className={f.label}>{label}</Label>}
      <div className={`${f.frame} ${s.frame}`}>
        {leadingAdornment !== undefined && <span className={s.adornment} data-wzl-subordinate="">{leadingAdornment}</span>}
        <RACInput ref={ref} enterKeyHint={enterKeyHint} autoCapitalize={autoCapitalize} placeholder={mixed ? MIXED_HINT : placeholder} />
        {trailingAdornment !== undefined && <span className={s.adornment} data-wzl-subordinate="">{trailingAdornment}</span>}
      </div>
      <FieldFoot description={description} errorMessage={errorMessage} />
    </TextField>,
  );
});
