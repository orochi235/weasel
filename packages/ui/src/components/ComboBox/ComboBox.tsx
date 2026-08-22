import type { ReactNode } from 'react';
import {
  ComboBox as RACComboBox,
  Label,
  Input as RACInput,
  Button as RACButton,
  Popover as RACPopover,
  ListBox as RACListBox,
  ListBoxItem as RACListBoxItem,
  Text,
  FieldError,
  type ComboBoxProps as RACComboBoxProps,
  type ListBoxItemProps as RACListBoxItemProps,
  type ValidationResult,
} from 'react-aria-components';
import { fieldClasses } from '../Field/Field';
import s from './ComboBox.module.css';

/**
 * One option in a {@link ComboBox}'s `options` list. `textValue` is the
 * plain-text form used for filtering and screen readers, needed only when
 * `label` isn't a bare string.
 */
export type ComboBoxOption = {
  value: string;
  label: ReactNode;
  textValue?: string;
  isDisabled?: boolean;
};

type Key = string | number;

/**
 * Props for {@link ComboBox}, on top of React Aria's `ComboBox` props, with
 * the selection key narrowed to the option value type.
 */
export type ComboBoxProps<T extends Key = string> = Omit<RACComboBoxProps<object>, 'children' | 'className' | 'selectedKey' | 'defaultSelectedKey' | 'onSelectionChange'> & {
  label?: ReactNode;
  description?: ReactNode;
  errorMessage?: ReactNode | ((v: ValidationResult) => ReactNode);
  placeholder?: string;
  options?: ReadonlyArray<ComboBoxOption & { value: T }>;
  children?: ReactNode;
  selectedKey?: T | null;
  defaultSelectedKey?: T;
  onSelectionChange?: (key: T | null) => void;
  emptyLabel?: ReactNode;
  className?: string;
};

/**
 * Filterable single-select wrapping React Aria's ComboBox. The user can
 * type to filter; selection commits to `onSelectionChange`. When no value
 * is in the input, selection clears (key becomes null).
 */
export function ComboBox<T extends Key = string>(props: ComboBoxProps<T>) {
  const {
    label,
    description,
    errorMessage,
    placeholder,
    options,
    children,
    selectedKey,
    defaultSelectedKey,
    onSelectionChange,
    emptyLabel = 'No matches',
    className,
    ...rest
  } = props;

  return (
    <RACComboBox
      {...rest}
      selectedKey={selectedKey}
      defaultSelectedKey={defaultSelectedKey}
      onSelectionChange={onSelectionChange ? (k) => onSelectionChange(k as T | null) : undefined}
      className={[s.field, fieldClasses.root, className].filter(Boolean).join(' ')}
    >
      {label !== undefined && <Label className={fieldClasses.label}>{label}</Label>}
      <div className={s.frame}>
        <RACInput placeholder={placeholder} />
        <RACButton className={s.openButton} aria-label="Show options">
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </RACButton>
      </div>
      {description !== undefined && (
        <Text slot="description" className={fieldClasses.hint}>
          {description}
        </Text>
      )}
      <FieldError className={fieldClasses.error}>{errorMessage}</FieldError>
      <RACPopover className={s.popover} data-weasel-overlay="">
        <RACListBox className={s.listbox} renderEmptyState={() => <div className={s.empty}>{emptyLabel}</div>}>
          {options !== undefined
            ? options.map((o) => (
                <ComboBoxItem key={String(o.value)} id={o.value} textValue={o.textValue} isDisabled={o.isDisabled}>
                  {o.label}
                </ComboBoxItem>
              ))
            : children}
        </RACListBox>
      </RACPopover>
    </RACComboBox>
  );
}

/** Props for {@link ComboBoxItem}, on top of React Aria's `ListBoxItem` props. */
export type ComboBoxItemProps = Omit<RACListBoxItemProps, 'className'> & {
  className?: string;
};

/** One row in a {@link ComboBox}'s filtered list. */
export function ComboBoxItem({ className, ...rest }: ComboBoxItemProps) {
  return <RACListBoxItem {...rest} className={[s.option, className].filter(Boolean).join(' ')} />;
}
