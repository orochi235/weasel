import { useContext, useLayoutEffect, useState, type ReactNode, type Ref } from 'react';
import { useObjectRef } from 'react-aria';
import {
  Select as RACSelect,
  Label,
  Button as RACButton,
  SelectValue,
  ListBox as RACListBox,
  SelectStateContext,
  type SelectProps as RACSelectProps,
} from 'react-aria-components';
import { Popover } from '../Popover';
import { useHeldPick } from '../heldItem';
import { AlignOverTrigger, BELOW, NO_NUDGE, useTriggerPress } from './alignOverTrigger';
import { FieldFoot, fieldRootClass, type FieldSlotProps, type FieldStateProps } from '../Field/fieldSlots';
import { useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
import { useRacField } from '../Field/racField';
import { shows } from '../Field/fieldSemantics';
import f from '../Field/Field.module.css';
import listbox from './listbox.module.css';
import s from './Select.module.css';
import { TriggerTooltip, tooltipContent, type TooltipFields } from '../Tooltip/buttonTooltip';
import type { HoldProps } from '../Disabled';
import { useRacHold } from '../Disabled/racHold';
import type { ControlSizeProps } from '../ControlSize';
import { useFieldSizeClass } from '../Field/fieldSize';
import type { ListOption } from '../listOption';
import { Caret } from '../Caret';
import { FitSizer } from './optionLabels';
import { InTrigger, renderOption, SelectSection } from './selectItem';

export { SelectItem, SelectSection, type SelectItemProps, type SelectSectionProps } from './selectItem';
import { MIXED_HINT } from '../Field/mixedHint';
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
export type SelectProps<T extends OptionKey = string> = Omit<RACSelectProps<object>, 'children' | 'className' | 'selectedKey' | 'defaultSelectedKey' | 'onSelectionChange' | 'value' | 'defaultValue' | 'onChange' | 'selectionMode' | 'isDisabled' | 'isOpen' | 'isInvalid' | 'isRequired'> & FieldSlotProps & FieldStateProps & HoldProps & ControlSizeProps & {
  /** Whether the list is open, controlled; pairs with `defaultOpen` and `onOpenChange`. */
  open?: boolean;
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
  /** Id for the trigger button, the select's focusable element, for a `<label htmlFor>` outside it. */
  id?: string;
  /** Receives the trigger `<button>`, to move focus to it. */
  ref?: Ref<HTMLButtonElement>;
  className?: string;
} & TooltipFields & OverlayPortalProps;

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
 *
 * Inside a `Field`, and with no `label` or `aria-label` of its own, it takes the field's label, description and
 * error. `id` and `ref` reach the trigger `<button>`.
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
    id,
    ref,
    className,
    portalContainer,
    shortcut,
    tooltip,
    size,
    open,
    invalid,
    required,
    ...given
  } = hold.rest;
  // Dropped at run time too, for a caller the types do not reach.
  const {
    value: _value, defaultValue: _defaultValue, onChange: _onChange, selectionMode: _mode,
    isDisabled: _disabled, isOpen: _open, isInvalid: _invalid, isRequired: _required, ...rest
  } = given as typeof given & Partial<RACSelectProps<object>>;

  const { anchor, provide, ready } = useOverlayPortal(portalContainer);
  // Uncontrolled, the key is held here rather than by React Aria, whose closed trigger changes it from the keyboard
  // whatever `isOpen` says; a held select then drops the change with the rest.
  const [ownKey, setOwnKey] = useState<T | null>(defaultSelectedKey ?? null);
  const shownKey = selectedKey === undefined ? ownKey : selectedKey;
  const placeholder = mixed ? MIXED_HINT : placeholderProp;
  const triggerRef = useObjectRef(ref);
  const [pressRef, onPress] = useTriggerPress();
  const { probe, pick } = useHeldPick(SelectStateContext, triggerRef);
  const [nudge, setNudge] = useState(NO_NUDGE);
  // React Aria's own localized placeholder, read off the trigger, for a `width='fit'` sizer given none.
  const [ownHint, setOwnHint] = useState<ReactNode>(undefined);
  const keepsHint = width === 'fit' && placeholder === undefined;
  const sized = useFieldSizeClass(size, className);
  const { id: triggerId, ...field } = useRacField({ id, 'aria-label': rest['aria-label'], 'aria-labelledby': rest['aria-labelledby'], 'aria-describedby': racHeld['aria-describedby'], invalid, required, labeled: shows(label) });

  return hold.wrap(
    <RACSelect
      {...rest}
      {...racHeld}
      {...field}
      {...(held ? { isOpen: false, onOpenChange: undefined } : open !== undefined ? { isOpen: open } : {})}
      selectedKey={mixed ? null : shownKey}
      onSelectionChange={(picked) => {
        // A mixed select hands React Aria no value, so its arrows step from there.
        const k = held ? undefined : pick(mixed ? null : shownKey, picked);
        if (k === undefined) return;
        if (selectedKey === undefined) setOwnKey(k as T | null);
        onSelectionChange?.(k as T);
      }}
      className={selectClass({ orientation, width, variant, indicator, className: sized })}
    >
      {anchor}{probe}
      {shows(label) && <Label className={f.label}>{label}</Label>}
      <TriggerTooltip
        content={tooltipContent({ tooltip, shortcut, ariaLabel: rest['aria-label'], label })}
        disabled={!hold.access.reachable || hold.access.reason !== undefined}
      >
        <RACButton
          id={triggerId}
          ref={triggerRef}
          className={`${f.frame} ${s.trigger}`}
          onPointerDown={onPress}
        >
          <TriggerValue placeholder={placeholder} keyed={shownKey != null} onOwnHint={keepsHint ? setOwnHint : undefined} />
          {width === 'fit' && <FitSizer className={s.sizer} placeholder={placeholder ?? ownHint} options={options} section={SelectSection}>{children}</FitSizer>}
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
          // With no selected row to land on the trigger, an 'over' list hangs below it and flips like one.
          shouldFlip={popup !== 'over' || nudge === BELOW}
        >
          {popup === 'over' && (
            <AlignOverTrigger
              triggerRef={triggerRef}
              pressRef={pressRef}
              applied={nudge}
              onMeasure={setNudge}
              content={options ?? children}
            />
          )}
          <SelectList options={options}>{children}</SelectList>
        </Popover>
      )}
    </RACSelect>,
  );
}

/** The trigger's text: the selected row's label, or the placeholder, React Aria's own handed to `onOwnHint`.
 *  `keyed` says a key is selected, whether or not a row holds it. */
function TriggerValue({ placeholder, keyed, onOwnHint }: { placeholder: ReactNode; keyed: boolean; onOwnHint?: (hint: ReactNode) => void }) {
  const rows = useContext(SelectStateContext)?.collection.size ?? 0;
  // A key that names no row shows the placeholder too; one that names a row shows it only until the rows are built.
  const hinted = !keyed || rows > 0;
  return (
    <SelectValue className={s.value}>
      {({ defaultChildren, isPlaceholder }) =>
        isPlaceholder ? (
          <>
            {placeholder ?? defaultChildren}
            {onOwnHint && hinted && <Report value={defaultChildren} to={onOwnHint} />}
          </>
        ) : <InTrigger.Provider value>{defaultChildren}</InTrigger.Provider>
      }
    </SelectValue>
  );
}

/** Hands `value` up to a parent that cannot read it, before paint. */
function Report<V>({ value, to }: { value: V; to: (v: V) => void }) {
  useLayoutEffect(() => to(value), [value, to]);
  return null;
}

/** The classes on a select's root, for its layout, variant and indicator. */
function selectClass({ orientation, width, variant, indicator, className }: Pick<SelectProps, 'orientation' | 'width' | 'variant' | 'indicator' | 'className'>): string {
  return fieldRootClass({
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
  });
}

/** A select's list: its `options`, or else its `children`. */
function SelectList<T extends OptionKey>({ options, children }: Pick<SelectProps<T>, 'options' | 'children'>) {
  if (options !== undefined) assertDistinct(options);
  return (
    <RACListBox className={listbox.list}>
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

/** Throws on two option values that read the same as text, as `1` and `'1'` do: React Aria keys rows by that text. */
function assertDistinct<T extends OptionKey>(options: ReadonlyArray<ListOption<T> | SelectOptionGroup<T>>): void {
  const seen = new Set<string>();
  for (const o of options.flatMap((e) => (isGroup(e) ? e.options : [e]))) {
    const text = String(o.value);
    if (seen.has(text)) throw new RangeError(`weasel: Select has two options whose values read "${text}"; each option's value must differ from every other's as text.`);
    seen.add(text);
  }
}
