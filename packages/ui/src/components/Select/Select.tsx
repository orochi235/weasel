import { Children, isValidElement, type ReactNode } from 'react';
import {
  Select as RACSelect,
  Label,
  Button as RACButton,
  SelectValue,
  Popover as RACPopover,
  ListBox as RACListBox,
  ListBoxItem as RACListBoxItem,
  Text,
  FieldError,
  type SelectProps as RACSelectProps,
  type ListBoxItemProps as RACListBoxItemProps,
  type ValidationResult,
} from 'react-aria-components';
import { fieldClasses } from '../Field/Field';
import { useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
import s from './Select.module.css';

/** One option in a {@link Select}'s `options` list. */
export type SelectOption = {
  value: string;
  label: ReactNode;
  isDisabled?: boolean;
  /**
   * Plain-text form of `label`, for type-to-select and screen readers.
   * Only needed when `label` isn't a bare string — a label built from
   * elements has no text React Aria can read off it. A string label
   * supplies this itself.
   */
  textValue?: string;
};

type Key = string | number;

/**
 * Props for {@link Select}, on top of React Aria's `Select` props, with the
 * selection key narrowed to the option value type.
 */
export type SelectProps<T extends Key = string> = Omit<RACSelectProps<object>, 'children' | 'className' | 'selectedKey' | 'defaultSelectedKey' | 'onSelectionChange'> & {
  label?: ReactNode;
  description?: ReactNode;
  errorMessage?: ReactNode | ((v: ValidationResult) => ReactNode);
  placeholder?: string;
  /** Either pass `options` for a quick render, or `children` for full control. */
  options?: ReadonlyArray<SelectOption & { value: T }>;
  children?: ReactNode;
  selectedKey?: T | null;
  defaultSelectedKey?: T;
  onSelectionChange?: (key: T) => void;
  /**
   * `'fill'` (the default) takes the width of whatever row the select sits in.
   * `'fit'` sizes the trigger to its widest option, so it neither swallows a
   * toolbar's slack nor changes width as the selection moves.
   */
  width?: 'fill' | 'fit';
  className?: string;
} & OverlayPortalProps;

/**
 * Form select wrapping React Aria's Select. Pass either `options` for a
 * quick declarative render or `children` of `<SelectItem>` for control over
 * each row.
 *
 * The selection key type is parameterized so consumers with a string-literal
 * union for `value` (e.g. `'r' | 'g' | 'b'`) get a typed `onSelectionChange`.
 */
export function Select<T extends Key = string>(props: SelectProps<T>) {
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
    width = 'fill',
    className,
    portalContainer,
    ...rest
  } = props;

  const { anchor, portalContainer: container } = useOverlayPortal(portalContainer);

  return (
    <RACSelect
      {...rest}
      selectedKey={selectedKey}
      defaultSelectedKey={defaultSelectedKey}
      onSelectionChange={onSelectionChange ? (k) => onSelectionChange(k as T) : undefined}
      className={[s.field, width === 'fit' && s.fit, fieldClasses.root, className]
        .filter(Boolean)
        .join(' ')}
    >
      {anchor}
      {label !== undefined && <Label className={fieldClasses.label}>{label}</Label>}
      <RACButton className={s.trigger}>
        <SelectValue className={s.value}>
          {({ defaultChildren, isPlaceholder }) =>
            isPlaceholder ? (placeholder ?? defaultChildren) : defaultChildren
          }
        </SelectValue>
        {width === 'fit' && (
          <span className={s.sizer} aria-hidden="true">
            {placeholder !== undefined && <span>{placeholder}</span>}
            {optionLabels(options, children).map((l, i) => (
              <span key={i}>
                <CheckMark />
                {l}
              </span>
            ))}
          </span>
        )}
        <svg className={s.chevron} viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </RACButton>
      {description !== undefined && (
        <Text slot="description" className={fieldClasses.hint}>
          {description}
        </Text>
      )}
      <FieldError className={fieldClasses.error}>{errorMessage}</FieldError>
      {/* `data-weasel-overlay` marks DOM that belongs to this control but
          renders in a portal, outside the subtree the trigger sits in. Any
          consumer reasoning about "did focus leave my component?" via
          `closest()` gets the wrong answer without it — a text editor whose
          font menu lives here would end its session the moment the menu is
          clicked. */}
      <RACPopover className={s.popover} data-weasel-overlay="" UNSTABLE_portalContainer={container}>
        <RACListBox className={s.listbox}>
          {options !== undefined
            ? options.map((o) => (
                <SelectItem
                  key={String(o.value)}
                  id={o.value}
                  isDisabled={o.isDisabled}
                  textValue={o.textValue}
                >
                  {o.label}
                </SelectItem>
              ))
            : children}
        </RACListBox>
      </RACPopover>
    </RACSelect>
  );
}

/* A selected row's mark travels into the trigger with its label, so a
   `width='fit'` sizer has to allow for it too. */
function CheckMark() {
  return (
    <svg className={s.check} viewBox="0 0 10 10" aria-hidden="true">
      <polyline points="1.5,5 4,7.5 8.5,3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The labels a `width='fit'` trigger measures itself against. In the children
 * form the label sits one element deep, inside a `SelectItem`.
 */
function optionLabels(
  options: ReadonlyArray<SelectOption> | undefined,
  children: ReactNode,
): ReactNode[] {
  if (options !== undefined) return options.map((o) => o.label);
  return Children.toArray(children).map((c) =>
    isValidElement<{ children?: ReactNode }>(c) ? c.props.children : c,
  );
}

/** Props for {@link SelectItem}, on top of React Aria's `ListBoxItem` props. */
export type SelectItemProps = Omit<RACListBoxItemProps, 'className' | 'children'> & {
  children?: ReactNode;
  className?: string;
};

/**
 * Every row renders a check mark beside its label, so from React Aria's
 * side the children are never plain text and it can't derive the string
 * type-to-select and screen readers need — it warns once per row. A string
 * label already *is* that string, so derive it rather than making every
 * call site restate it; anything richer has to say what it reads as.
 */
function textValueOf(children: ReactNode, explicit: string | undefined): string | undefined {
  if (explicit !== undefined) return explicit;
  return typeof children === 'string' || typeof children === 'number'
    ? String(children)
    : undefined;
}

/**
 * One row in a {@link Select}'s list, with a leading check mark when
 * selected. A string child supplies its own `textValue`; anything richer must
 * pass one so type-to-select and screen readers have something to read.
 */
export function SelectItem({ children, className, textValue, ...rest }: SelectItemProps) {
  return (
    <RACListBoxItem
      {...rest}
      textValue={textValueOf(children, textValue)}
      className={[s.option, className].filter(Boolean).join(' ')}
    >
      <CheckMark />
      {children}
    </RACListBoxItem>
  );
}
