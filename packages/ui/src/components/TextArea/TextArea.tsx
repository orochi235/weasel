import { forwardRef, type ReactNode, type Ref } from 'react';
import {
  FieldError,
  Label,
  TextArea as RACTextArea,
  Text,
  TextField,
  type TextFieldProps as RACTextFieldProps,
  type ValidationResult,
} from 'react-aria-components';
import f from '../field.module.css';
import s from './TextArea.module.css';

/** Props for {@link TextArea}, on top of React Aria's `TextField` props. */
export type TextAreaProps = Omit<RACTextFieldProps, 'children' | 'className'> & {
  label?: ReactNode;
  description?: ReactNode;
  errorMessage?: ReactNode | ((v: ValidationResult) => ReactNode);
  placeholder?: string;
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
  const { label, description, errorMessage, placeholder, rows = 4, className, ...textFieldProps } = props;
  return (
    <TextField {...textFieldProps} className={[f.field, f.control, className].filter(Boolean).join(' ')}>
      {label !== undefined && <Label className={f.label}>{label}</Label>}
      <div className={`${f.frame} ${s.frame}`}>
        <RACTextArea ref={ref} placeholder={placeholder} rows={rows} />
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
