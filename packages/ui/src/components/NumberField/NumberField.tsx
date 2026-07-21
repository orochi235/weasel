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
import { fieldClasses } from '../Field/Field';
import s from './NumberField.module.css';

export type NumberFieldProps = Omit<RACNumberFieldProps, 'children' | 'className'> & {
  label?: ReactNode;
  description?: ReactNode;
  errorMessage?: ReactNode | ((v: ValidationResult) => ReactNode);
  /** Hide the up/down stepper buttons. Defaults to false. */
  hideSteppers?: boolean;
  /** Native input placeholder — e.g. `'Mixed'` for a multi-selection
   *  editor with no shared value. */
  placeholder?: string;
  className?: string;
};

export const NumberField = forwardRef(function NumberField(
  props: NumberFieldProps,
  ref: Ref<HTMLInputElement>,
) {
  const { label, description, errorMessage, hideSteppers, placeholder, className, ...rest } = props;
  return (
    <RACNumberField
      {...rest}
      className={[s.field, fieldClasses.root, className].filter(Boolean).join(' ')}
    >
      {label !== undefined && <Label className={fieldClasses.label}>{label}</Label>}
      <Group className={s.frame}>
        <RACInput ref={ref} placeholder={placeholder} />
        {!hideSteppers && (
          <div className={s.steppers}>
            <RACButton slot="increment" className={s.stepper} aria-label="Increment">▲</RACButton>
            <RACButton slot="decrement" className={s.stepper} aria-label="Decrement">▼</RACButton>
          </div>
        )}
      </Group>
      {description !== undefined && (
        <Text slot="description" className={fieldClasses.hint}>
          {description}
        </Text>
      )}
      <FieldError className={fieldClasses.error}>{errorMessage}</FieldError>
    </RACNumberField>
  );
});
