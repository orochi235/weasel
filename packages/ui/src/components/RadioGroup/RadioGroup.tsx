import type { ReactNode } from 'react';
import {
  RadioGroup as RACRadioGroup,
  Radio as RACRadio,
  Label,
  Text,
  FieldError,
  type RadioGroupProps as RACRadioGroupProps,
  type RadioProps as RACRadioProps,
  type ValidationResult,
} from 'react-aria-components';
import { fieldClasses } from '../Field/Field';
import s from './RadioGroup.module.css';

export type RadioGroupProps = Omit<RACRadioGroupProps, 'children' | 'className'> & {
  label?: ReactNode;
  description?: ReactNode;
  errorMessage?: ReactNode | ((v: ValidationResult) => ReactNode);
  children?: ReactNode;
  className?: string;
};

export function RadioGroup(props: RadioGroupProps) {
  const { label, description, errorMessage, children, className, ...rest } = props;
  return (
    <RACRadioGroup
      {...rest}
      className={[s.group, fieldClasses.root, className].filter(Boolean).join(' ')}
    >
      {label !== undefined && <Label className={s.legend}>{label}</Label>}
      {children}
      {description !== undefined && (
        <Text slot="description" className={fieldClasses.hint}>
          {description}
        </Text>
      )}
      <FieldError className={fieldClasses.error}>{errorMessage}</FieldError>
    </RACRadioGroup>
  );
}

export type RadioProps = Omit<RACRadioProps, 'className' | 'children'> & {
  children?: ReactNode;
  className?: string;
};

export function Radio({ children, className, ...rest }: RadioProps) {
  return (
    <RACRadio {...rest} className={[s.radio, className].filter(Boolean).join(' ')}>
      <span className={s.dot} />
      {children !== undefined && <span>{children}</span>}
    </RACRadio>
  );
}
