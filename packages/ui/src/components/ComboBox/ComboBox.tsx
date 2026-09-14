import { Children, isValidElement, useContext, type KeyboardEvent, type ReactNode } from 'react';
import {
  ComboBox as RACComboBox,
  ComboBoxStateContext,
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
import { useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
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
 * How the typed text narrows the options.
 *
 * `'contains'` is a locale-aware substring match over each option's text.
 * `'none'` shows every option given — what a list a server already filtered
 * and ranked needs, since a second pass would drop rows that do not contain
 * the query and reorder whatever survived.
 */
export type ComboBoxFilter = 'contains' | 'none' | ((textValue: string, inputValue: string) => boolean);

/** What the user committed: an option they picked, or text they typed. */
export type ComboBoxCommit<T extends Key = string> =
  | { source: 'option'; key: T }
  | { source: 'text'; text: string };

const admitEverything = () => true;

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
  /** Shown in place of `emptyLabel` while `loadError` is set. */
  errorLabel?: ReactNode;
  /**
   * How typed text narrows `options`. Defaults to `'contains'`. `'none'` also
   * keeps the popover open on an empty collection: a list the kit does not
   * filter can arrive empty from a server mid-query, and without that the
   * popover closes and `emptyLabel` is never seen.
   */
  filter?: ComboBoxFilter;
  /** Marks the options as out of date while the next set is being fetched. */
  isLoading?: boolean;
  /** A failed load, shown as `errorLabel` rather than as an empty corpus. */
  loadError?: unknown | null;
  /**
   * Fires when the user commits — Enter on the active option, a click on one,
   * or Enter on text matching none of them when `allowsCustomValue` is set.
   * Empty text commits nothing.
   */
  onCommit?: (commit: ComboBoxCommit<T>) => void;
  /**
   * `'fill'` (the default) takes the width of whatever row the combo box sits
   * in. `'fit'` sizes the input to its widest option, so it neither swallows a
   * toolbar's slack nor cuts a selection off once one is made.
   */
  width?: 'fill' | 'fit';
  className?: string;
} & OverlayPortalProps;

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
    errorLabel = "Couldn't load options",
    filter = 'contains',
    isLoading,
    loadError = null,
    onCommit,
    width = 'fill',
    className,
    portalContainer,
    ...rest
  } = props;

  const { anchor, portalProps } = useOverlayPortal(portalContainer);

  return (
    <RACComboBox
      {...rest}
      // 'contains' leaves this unset so React Aria uses its own locale-aware
      // match rather than a reimplementation of it.
      defaultFilter={filter === 'none' ? admitEverything : filter === 'contains' ? undefined : filter}
      allowsEmptyCollection={rest.allowsEmptyCollection ?? filter === 'none'}
      selectedKey={selectedKey}
      defaultSelectedKey={defaultSelectedKey}
      onSelectionChange={(k) => {
        onSelectionChange?.(k as T | null);
        if (k !== null) onCommit?.({ source: 'option', key: k as T });
      }}
      className={[s.field, width === 'fit' && s.fit, fieldClasses.root, className]
        .filter(Boolean)
        .join(' ')}
    >
      {anchor}
      {label !== undefined && <Label className={fieldClasses.label}>{label}</Label>}
      <ComboBoxFrame
        placeholder={placeholder}
        isLoading={isLoading}
        onCommitText={onCommit && ((text) => onCommit({ source: 'text', text }))}
      >
        {width === 'fit' && (
          <span className={s.sizer} aria-hidden="true">
            {placeholder !== undefined && <span>{placeholder}</span>}
            {optionLabels(options, children).map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </span>
        )}
      </ComboBoxFrame>
      {description !== undefined && (
        <Text slot="description" className={fieldClasses.hint}>
          {description}
        </Text>
      )}
      <FieldError className={fieldClasses.error}>{errorMessage}</FieldError>
      <RACPopover className={s.popover} data-weasel-overlay="" {...portalProps}>
        <RACListBox
          className={s.listbox}
          renderEmptyState={() =>
            loadError !== null ? (
              <div className={s.error} role="alert">{errorLabel}</div>
            ) : (
              <div className={s.empty}>{emptyLabel}</div>
            )
          }
        >
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
 * The input and its trigger. Split out so it can read `ComboBoxStateContext`,
 * which only exists below `RACComboBox`.
 */
function ComboBoxFrame({
  placeholder,
  isLoading,
  onCommitText,
  children,
}: {
  placeholder?: string;
  isLoading?: boolean;
  onCommitText?: (text: string) => void;
  children?: ReactNode;
}) {
  const state = useContext(ComboBoxStateContext);

  // Capture, not bubble: React Aria's own Enter handler runs on the way up and
  // clears the focused key, so by then there is no way to tell an option
  // commit from a text one.
  const onKeyDownCapture = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    if (state?.isOpen && state.selectionManager.focusedKey != null) return;
    const text = e.currentTarget.value;
    if (text !== '') onCommitText?.(text);
  };

  return (
    <div className={s.frame}>
      <RACInput
        placeholder={placeholder}
        aria-busy={isLoading || undefined}
        onKeyDownCapture={onCommitText ? onKeyDownCapture : undefined}
      />
      {children}
      <RACButton className={s.openButton} aria-label="Show options">
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </RACButton>
    </div>
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
