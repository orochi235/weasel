import { useContext, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import {
  ComboBox as RACComboBox,
  ComboBoxStateContext,
  Label,
  Input as RACInput,
  Button as RACButton,
  ListBox as RACListBox,
  ListBoxItem as RACListBoxItem,
  Text,
  type ComboBoxProps as RACComboBoxProps,
  type ListBoxItemProps as RACListBoxItemProps,
} from 'react-aria-components';
import { imeKey } from '@weasel-js/ui-input';
import { Popover } from '../Popover';
import { FieldFoot, fieldRootClass, type FieldSlotProps } from '../Field/fieldSlots';
import { useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
import { Caret } from '../Caret';
import { optionLabels, withIcon } from '../optionLabels';
import type { HoldProps } from '../Disabled';
import { useRacHold } from '../Disabled/racHold';
import type { ListOption } from '../listOption';
import type { OptionKey } from '../../optionKey';
import f from '../field.module.css';
import listbox from '../listbox.module.css';
import s from './ComboBox.module.css';


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
export type ComboBoxCommit<T extends OptionKey = string> =
  | { source: 'option'; key: T }
  | { source: 'text'; text: string };

const admitEverything = () => true;

/**
 * Props for {@link ComboBox}, on top of React Aria's `ComboBox` props, with
 * the selection key narrowed to the option value type.
 */
export type ComboBoxProps<T extends OptionKey = string> = Omit<RACComboBoxProps<object>, 'children' | 'className' | 'selectedKey' | 'defaultSelectedKey' | 'onSelectionChange' | 'isDisabled' | 'isReadOnly'> & FieldSlotProps & HoldProps & {
  placeholder?: string;
  options?: ReadonlyArray<ListOption<T>>;
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
   * Fires when the user commits — Enter on the highlighted option, a click on
   * one, or, when `allowsCustomValue` is set, Enter with no option highlighted.
   * That last one is a text commit even when the text is an option's own label.
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
export function ComboBox<T extends OptionKey = string>(props: ComboBoxProps<T>) {
  const hold = useRacHold(props);
  const {
    label,
    orientation,
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
  } = hold.rest;

  const { anchor, provide, ready } = useOverlayPortal(portalContainer);
  const revertingRef = useRef(false);

  return hold.wrap(
    <RACComboBox
      {...rest}
      {...hold.rac}
      // 'contains' leaves this unset so React Aria uses its own locale-aware
      // match rather than a reimplementation of it.
      defaultFilter={filter === 'none' ? admitEverything : filter === 'contains' ? undefined : filter}
      allowsEmptyCollection={rest.allowsEmptyCollection ?? filter === 'none'}
      selectedKey={selectedKey}
      defaultSelectedKey={defaultSelectedKey}
      onSelectionChange={(k) => {
        onSelectionChange?.(k as T | null);
        if (k !== null && !revertingRef.current) onCommit?.({ source: 'option', key: k as T });
      }}
      className={fieldRootClass({ orientation, width, fit: s.fit, className })}
    >
      {anchor}
      {label !== undefined && <Label className={f.label}>{label}</Label>}
      <ComboBoxFrame
        placeholder={placeholder}
        isLoading={isLoading}
        revertingRef={revertingRef}
        onCommitText={onCommit && rest.allowsCustomValue ? (text) => onCommit({ source: 'text', text }) : undefined}
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
      <FieldFoot description={description} errorMessage={errorMessage} />
      {ready && provide(
        <Popover className={s.popover} data-weasel-overlay="">
          <RACListBox
            className={`${listbox.surface} ${listbox.list}`}
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
                  <ComboBoxItem
                    key={String(o.value)} id={o.value} textValue={o.textValue} disabled={o.disabled} icon={o.icon}
                    description={o.description} disabledReason={o.disabledReason}
                  >
                    {o.label}
                  </ComboBoxItem>
                ))
              : children}
          </RACListBox>
        </Popover>
      )}
    </RACComboBox>,
  );
}

/**
 * The input and its trigger. Split out so it can read `ComboBoxStateContext`,
 * which only exists below `RACComboBox`.
 */
function ComboBoxFrame({
  placeholder,
  isLoading,
  revertingRef,
  onCommitText,
  children,
}: {
  placeholder?: string;
  isLoading?: boolean;
  /** Set while React Aria puts the selection back on a blur, or on an Enter with no option highlighted: with both
   *  `selectedKey` and `inputValue` controlled it reports that as a selection, which nobody picked. */
  revertingRef: RefObject<boolean>;
  onCommitText?: (text: string) => void;
  children?: ReactNode;
}) {
  const state = useContext(ComboBoxStateContext);

  // Capture, not bubble: React Aria's own Enter handler runs on the way up and
  // clears the focused key, so by then there is no way to tell an option
  // commit from a text one.
  const onKeyDownCapture = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || imeKey(e.nativeEvent)) return;
    if (state?.isOpen && state.selectionManager.focusedKey != null) return;
    revertingRef.current = true;
    const text = e.currentTarget.value;
    if (text !== '') onCommitText?.(text);
  };
  const reverted = () => {
    revertingRef.current = false;
  };

  return (
    <div className={`${f.frame} ${s.frame}`}>
      <RACInput
        placeholder={placeholder}
        aria-busy={isLoading || undefined}
        onKeyDownCapture={onKeyDownCapture}
        onKeyDown={reverted}
        onBlurCapture={() => {
          revertingRef.current = true;
        }}
        onBlur={reverted}
      />
      {children}
      <RACButton className={s.openButton} aria-label="Show options">
        <Caret />
      </RACButton>
    </div>
  );
}

/** Props for {@link ComboBoxItem}, on top of React Aria's `ListBoxItem` props. */
export type ComboBoxItemProps = Omit<RACListBoxItemProps, 'className' | 'isDisabled' | 'children'> & {
  children?: ReactNode;
  className?: string;
  /** The row cannot be chosen. */
  disabled?: boolean;
  /** A glyph drawn before the label. */
  icon?: ReactNode;
  /** A line under the label, and the row's accessible description. */
  description?: string;
  /** Why the row is disabled, in place of `description` while `disabled`. */
  disabledReason?: string;
};

/** One row in a {@link ComboBox}'s filtered list. */
export function ComboBoxItem({ className, disabled, icon, description, disabledReason, children, textValue, ...rest }: ComboBoxItemProps) {
  const note = (disabled && disabledReason) || description;
  return (
    <RACListBoxItem
      {...rest}
      isDisabled={disabled}
      textValue={textValue ?? (typeof children === 'string' ? children : undefined)}
      className={[listbox.option, className].filter(Boolean).join(' ')}
    >
      {note ? (
        <span className={listbox.optionBody}>
          <span>{withIcon(icon, <Text slot="label">{children}</Text>)}</span>
          <Text slot="description" className={listbox.note}>{note}</Text>
        </span>
      ) : withIcon(icon, children)}
    </RACListBoxItem>
  );
}
