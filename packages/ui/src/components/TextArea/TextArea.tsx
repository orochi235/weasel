import { forwardRef, type Ref } from 'react';
import { Label, TextArea as RACTextArea, TextField, type TextFieldProps as RACTextFieldProps } from 'react-aria-components';
import { MIXED_HINT } from '../mixedHint';
import { FieldFoot, fieldRootClass, type FieldSlotProps } from '../Field/fieldSlots';
import f from '../field.module.css';
import s from './TextArea.module.css';

/** Props for {@link TextArea}, on top of React Aria's `TextField` props. */
export type TextAreaProps = Omit<RACTextFieldProps, 'children' | 'className'> & FieldSlotProps & {
  placeholder?: string;
  /** The field stands for several values that differ: it reads `Mixed` in
   *  place of `placeholder` while its value is empty. */
  mixed?: boolean;
  /** Lines of text the box shows before it scrolls. Default 4; the user can drag it taller. */
  rows?: number;
  className?: string;
};

/**
 * Multi-line text input wrapping React Aria's TextField, in the same frame and
 * label / description / errorMessage slots as {@link Input}.
 *
 * `ref` forwards to the underlying `<textarea>`.
 */
export const TextArea = forwardRef(function TextArea(props: TextAreaProps, ref: Ref<HTMLTextAreaElement>) {
  const { label, orientation, description, errorMessage, placeholder, mixed, rows = 4, className, ...textFieldProps } = props;
  return (
    <TextField {...textFieldProps} className={fieldRootClass({ orientation, className })}>
      {label !== undefined && <Label className={f.label}>{label}</Label>}
      <div className={`${f.frame} ${s.frame}`}>
        <RACTextArea ref={ref} placeholder={mixed ? MIXED_HINT : placeholder} rows={rows} />
      </div>
      <FieldFoot description={description} errorMessage={errorMessage} />
    </TextField>
  );
});
