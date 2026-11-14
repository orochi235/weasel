import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import {
  Select as RACSelect,
  Label,
  Button as RACButton,
  SelectValue,
  ListBox as RACListBox,
  ListBoxItem as RACListBoxItem,
  ListBoxSection as RACListBoxSection,
  Header,
  Text,
  type SelectProps as RACSelectProps,
  type ListBoxItemProps as RACListBoxItemProps,
} from 'react-aria-components';
import { Popover } from '../Popover';
import { AlignOverTrigger, NO_NUDGE, type Press } from './alignOverTrigger';
import { FieldFoot, fieldRootClass, type FieldSlotProps } from '../Field/fieldSlots';
import { useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
import f from '../field.module.css';
import listbox from '../listbox.module.css';
import s from './Select.module.css';
import { TriggerTooltip, segmentTooltipContent, type SegmentTooltipFields } from '../segmentTooltip';
import type { HoldProps } from '../Disabled';
import { useRacHold } from '../Disabled/racHold';
import type { ListOption } from '../listOption';
import { Caret } from '../Caret';
import { optionLabels, withIcon } from '../optionLabels';
import { MIXED_HINT } from '../mixedHint';
import type { OptionKey } from '../../optionKey';

/** A titled group of options in a {@link Select}'s `options` list. */
export type SelectOptionGroup<T extends OptionKey = string> = {
  title: ReactNode;
  options: ReadonlyArray<ListOption<T>>;
};

function isGroup<T extends OptionKey>(
  entry: ListOption<T> | SelectOptionGroup<T>,
): entry is SelectOptionGroup<T> {
  return 'options' in entry;
}

/** How a {@link Select} trigger signals that it opens a list. */
export type SelectIndicator = 'chevron' | 'underline' | 'none';

/** Where a {@link Select}'s list opens relative to its trigger. */
export type SelectPopup = 'over' | 'below';

/**
 * Props for {@link Select}, on top of React Aria's `Select` props, with the
 * selection key narrowed to the option value type.
 */
export type SelectProps<T extends OptionKey = string> = Omit<RACSelectProps<object>, 'children' | 'className' | 'selectedKey' | 'defaultSelectedKey' | 'onSelectionChange' | 'isDisabled'> & FieldSlotProps & HoldProps & {
  placeholder?: string;
  /** The select stands for several values that differ: nothing is selected,
   *  and the trigger reads `Mixed` in place of `placeholder`. */
  mixed?: boolean;
  /**
   * Either pass `options` for a quick render, or `children` for full control.
   * An entry with `title` and `options` of its own is a titled section.
   */
  options?: ReadonlyArray<ListOption<T> | SelectOptionGroup<T>>;
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
  /** `'bare'` drops the box, for a select set in a row of other chrome such as a property row. */
  variant?: 'field' | 'bare';
  /**
   * How the trigger says it opens a list. `'chevron'` draws the caret beside
   * the value; `'underline'` marks the value itself, dotted at rest and solid
   * while it is pointed at or open; `'none'` says nothing. Unset takes the
   * variant's own: a boxed select shows the caret, a bare one — set in a row
   * where 10px of caret is a tenth of the value's width — underlines.
   */
  indicator?: SelectIndicator;
  /**
   * Where the list opens. `'over'` (the default) puts the selected row on the
   * trigger, its label in the trigger's own text column, so choosing what is
   * already chosen moves nothing; `'below'` hangs it under the trigger.
   */
  popup?: SelectPopup;
  /**
   * Id for the trigger button. React Aria puts a plain `id` on the wrapper,
   * which is not labelable, so an outer `<label for>` needs this to reach a
   * control the label can actually own.
   */
  triggerId?: string;
  className?: string;
} & SegmentTooltipFields & OverlayPortalProps;

/**
 * Form select wrapping React Aria's Select. Pass either `options` for a
 * quick declarative render or `children` of `<SelectItem>` for control over
 * each row; `<SelectSection>` (or an `options` entry with a `title`) groups
 * rows under a heading.
 *
 * The selection key type is parameterized so consumers with a string-literal
 * union for `value` (e.g. `'r' | 'g' | 'b'`) get a typed `onSelectionChange`.
 *
 * `shortcut` puts a kit tooltip on the trigger reading `Name (⌘K)`, named by
 * `aria-label` or a string `label`, as `Button` does; `tooltip` replaces that
 * text. Held disabled for a reason, or read-only, its trigger stays focusable and shows the reason, and its list
 * does not open.
 */
export function Select<T extends OptionKey = string>(props: SelectProps<T>) {
  const hold = useRacHold(props);
  // React Aria's Select has no read-only: a held one keeps its list shut and drops every change.
  const { isReadOnly: held, ...racHeld } = hold.rac;
  const {
    label,
    orientation,
    description,
    errorMessage,
    placeholder: placeholderProp,
    mixed,
    options,
    children,
    selectedKey,
    defaultSelectedKey,
    onSelectionChange,
    width = 'fill',
    variant = 'field',
    indicator = variant === 'bare' ? 'underline' : 'chevron',
    popup = 'over',
    triggerId,
    className,
    portalContainer,
    shortcut,
    tooltip,
    ...rest
  } = hold.rest;

  const { anchor, provide, ready } = useOverlayPortal(portalContainer);
  const placeholder = mixed ? MIXED_HINT : placeholderProp;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pressRef = useRef<Press | null>(null);
  const [nudge, setNudge] = useState(NO_NUDGE);

  return hold.wrap(
    <RACSelect
      {...rest}
      {...racHeld}
      {...(held ? { isOpen: false, onOpenChange: undefined } : {})}
      selectedKey={mixed ? null : selectedKey}
      defaultSelectedKey={defaultSelectedKey}
      onSelectionChange={onSelectionChange && !held ? (k) => onSelectionChange(k as T) : undefined}
      className={fieldRootClass({
        orientation,
        width,
        fit: s.fit,
        className: [
          s.select,
          variant === 'bare' && s.bare,
          indicator === 'underline' && s.underlined,
          indicator === 'none' && s.plain,
          orientation === 'row' && s.row,
          className,
        ]
          .filter(Boolean)
          .join(' '),
      })}
    >
      {anchor}
      {label !== undefined && <Label className={f.label}>{label}</Label>}
      <TriggerTooltip
        content={segmentTooltipContent({ tooltip, shortcut, ariaLabel: rest['aria-label'], label })}
        disabled={!hold.access.reachable || hold.access.reason !== undefined}
      >
        <RACButton
          id={triggerId}
          ref={triggerRef}
          className={`${f.frame} ${s.trigger}`}
          onPointerDown={(e) => {
            pressRef.current = { x: e.clientX, y: e.clientY, at: performance.now() };
          }}
        >
          <SelectValue className={s.value}>
            {({ defaultChildren, isPlaceholder }) =>
              isPlaceholder ? (placeholder ?? defaultChildren) : <InTrigger.Provider value>{defaultChildren}</InTrigger.Provider>
            }
          </SelectValue>
          {width === 'fit' && (
            <span className={s.sizer} aria-hidden="true">
              {placeholder !== undefined && <span>{placeholder}</span>}
              {optionLabels(options, children, SelectSection).map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </span>
          )}
          {indicator === 'chevron' && <Caret className={s.chevron} />}
        </RACButton>
      </TriggerTooltip>
      <FieldFoot description={description} errorMessage={errorMessage} />
      {/* `data-weasel-overlay` marks DOM that belongs to this control but
          renders in a portal, outside the subtree the trigger sits in. Any
          consumer reasoning about "did focus leave my component?" via
          `closest()` gets the wrong answer without it — a text editor whose
          font menu lives here would end its session the moment the menu is
          clicked. */}
      {ready && provide(
        <Popover
          className={s.popover}
          data-weasel-overlay=""
          placement="bottom start"
          offset={popup === 'over' ? nudge.offset : undefined}
          crossOffset={popup === 'over' ? nudge.crossOffset : undefined}
          shouldFlip={popup !== 'over'}
        >
          {popup === 'over' && (
            <AlignOverTrigger
              triggerRef={triggerRef}
              pressRef={pressRef}
              applied={nudge}
              onMeasure={setNudge}
            />
          )}
          <SelectList options={options}>{children}</SelectList>
        </Popover>
      )}
    </RACSelect>,
  );
}

/** A select's list: its `options`, or else its `children`. */
function SelectList<T extends OptionKey>({ options, children }: Pick<SelectProps<T>, 'options' | 'children'>) {
  return (
    <RACListBox className={`${listbox.surface} ${listbox.list}`}>
      {options !== undefined
        ? options.map((entry, i) =>
            isGroup(entry) ? (
              <SelectSection key={`section-${i}`} title={entry.title}>
                {entry.options.map(renderOption)}
              </SelectSection>
            ) : (
              renderOption(entry)
            ),
          )
        : children}
    </RACListBox>
  );
}

/** True inside `SelectValue`'s copy of the selected row, which shows its label and not its note. */
const InTrigger = createContext(false);

/* `SelectValue` copies the selected row into the trigger, mark included; the
   trigger hides it, so the `width='fit'` sizer leaves it out. */
function CheckMark() {
  return (
    <svg className={s.check} viewBox="0 0 10 10" aria-hidden="true">
      <polyline points="1.5,5 4,7.5 8.5,3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function renderOption<T extends OptionKey>(o: ListOption<T>) {
  return (
    <SelectItem
      key={String(o.value)} id={o.value} disabled={o.disabled} icon={o.icon} textValue={o.textValue}
      description={o.description} disabledReason={o.disabledReason}
    >
      {o.label}
    </SelectItem>
  );
}

/** Props for {@link SelectSection}. */
export type SelectSectionProps = {
  /** Heading shown above the section's rows; it also names the group for
   *  screen readers. */
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** A titled group of `SelectItem` rows in a {@link Select}'s list. */
export function SelectSection({ title, children, className }: SelectSectionProps) {
  return (
    <RACListBoxSection className={[s.section, className].filter(Boolean).join(' ')}>
      {title !== undefined && <Header className={s.sectionHeader}>{title}</Header>}
      {children}
    </RACListBoxSection>
  );
}

/** Props for {@link SelectItem}, on top of React Aria's `ListBoxItem` props. */
export type SelectItemProps = Omit<RACListBoxItemProps, 'className' | 'children' | 'isDisabled'> & {
  children?: ReactNode;
  /** The row cannot be chosen. */
  disabled?: boolean;
  /** A glyph drawn before the label, in the list and in the trigger. */
  icon?: ReactNode;
  /** A line under the label in the list, and the row's accessible description. */
  description?: string;
  /** Why the row is disabled, in place of `description` while `disabled`. */
  disabledReason?: string;
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
export function SelectItem({ children, icon, className, textValue, description, disabled, disabledReason, ...rest }: SelectItemProps) {
  const note = (disabled && disabledReason) || description;
  return (
    <RACListBoxItem
      {...rest}
      isDisabled={disabled}
      textValue={textValueOf(children, textValue)}
      className={[s.option, className].filter(Boolean).join(' ')}
    >
      <CheckMark />
      {/* A box around the label, not just text: landing the list over its
          trigger means measuring where this row's label sits. */}
      <span className={s.optionLabel}>
        {/* A description slot needs a label slot beside it, or the row's name takes in the description too. */}
        {note ? withIcon(icon, <Text slot="label">{children}</Text>) : withIcon(icon, children)}
        {note && <OptionNote>{note}</OptionNote>}
      </span>
    </RACListBoxItem>
  );
}

function OptionNote({ children }: { children: string }) {
  return useContext(InTrigger) ? null : <Text slot="description" className={s.note}>{children}</Text>;
}
