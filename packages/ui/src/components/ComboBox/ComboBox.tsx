import { Children, isValidElement, type ReactNode } from 'react';
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
  /**
   * `'fill'` (the default) takes the width of whatever row the combo box sits
   * in. `'fit'` sizes the input to its widest option, so it neither swallows a
   * toolbar's slack nor cuts a selection off once one is made.
   */
  width?: 'fill' | 'fit';
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
    width = 'fill',
    className,
    ...rest
  } = props;

  return (
    <RACComboBox
      {...rest}
      selectedKey={selectedKey}
      defaultSelectedKey={defaultSelectedKey}
      onSelectionChange={onSelectionChange ? (k) => onSelectionChange(k as T | null) : undefined}
      className={[s.field, width === 'fit' && s.fit, fieldClasses.root, className]
        .filter(Boolean)
        .join(' ')}
    >
      {label !== undefined && <Label className={fieldClasses.label}>{label}</Label>}
      <div className={s.frame}>
        <RACInput placeholder={placeholder} />
        {width === 'fit' && (
          <span className={s.sizer} aria-hidden="true">
            {placeholder !== undefined && <span>{placeholder}</span>}
            {optionLabels(options, children).map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </span>
        )}
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

/**
 * The labels a `width='fit'` input measures itself against. In the children
 * form the label sits one element deep, inside a `ComboBoxItem`.
 */
function optionLabels(
  options: ReadonlyArray<ComboBoxOption> | undefined,
  children: ReactNode,
): ReactNode[] {
  if (options !== undefined) return options.map((o) => o.label);
  return Children.toArray(children).map((c) =>
    isValidElement<{ children?: ReactNode }>(c) ? c.props.children : c,
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
