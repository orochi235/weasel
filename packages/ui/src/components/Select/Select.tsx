import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
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
import { fieldClasses, type FieldOrientation } from '../Field/Field';
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

/** How a {@link Select} trigger signals that it opens a list. */
export type SelectIndicator = 'chevron' | 'underline' | 'none';

/** Where a {@link Select}'s list opens relative to its trigger. */
export type SelectPopup = 'over' | 'below';

/**
 * Props for {@link Select}, on top of React Aria's `Select` props, with the
 * selection key narrowed to the option value type.
 */
export type SelectProps<T extends Key = string> = Omit<RACSelectProps<object>, 'children' | 'className' | 'selectedKey' | 'defaultSelectedKey' | 'onSelectionChange'> & {
  label?: ReactNode;
  /**
   * `'stacked'` (the default) puts the label above the trigger; `'row'` sets it
   * beside the trigger at its own width, with any description or error on a
   * line below. Same vocabulary as {@link Field}'s `orientation`.
   */
  orientation?: FieldOrientation;
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
    orientation = 'stacked',
    description,
    errorMessage,
    placeholder,
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
    ...rest
  } = props;

  const { anchor, portalProps } = useOverlayPortal(portalContainer);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pressRef = useRef<Press | null>(null);
  const [nudge, setNudge] = useState(NO_NUDGE);

  return (
    <RACSelect
      {...rest}
      selectedKey={selectedKey}
      defaultSelectedKey={defaultSelectedKey}
      onSelectionChange={onSelectionChange ? (k) => onSelectionChange(k as T) : undefined}
      className={[
        s.field,
        width === 'fit' && s.fit,
        variant === 'bare' && s.bare,
        indicator === 'underline' && s.underlined,
        indicator === 'none' && s.plain,
        fieldClasses.root,
        orientation === 'row' && fieldClasses.row,
        orientation === 'row' && s.row,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {anchor}
      {label !== undefined && <Label className={`${fieldClasses.label} ${s.label}`}>{label}</Label>}
      <RACButton
        id={triggerId}
        ref={triggerRef}
        className={s.trigger}
        onPointerDown={(e) => {
          pressRef.current = { x: e.clientX, y: e.clientY, at: performance.now() };
        }}
      >
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
        {indicator === 'chevron' && (
          <svg className={s.chevron} viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </RACButton>
      {description !== undefined && (
        <Text slot="description" className={`${fieldClasses.hint} ${s.below}`}>
          {description}
        </Text>
      )}
      <FieldError className={`${fieldClasses.error} ${s.below}`}>{errorMessage}</FieldError>
      {/* `data-weasel-overlay` marks DOM that belongs to this control but
          renders in a portal, outside the subtree the trigger sits in. Any
          consumer reasoning about "did focus leave my component?" via
          `closest()` gets the wrong answer without it — a text editor whose
          font menu lives here would end its session the moment the menu is
          clicked. */}
      <RACPopover
        className={s.popover}
        data-weasel-overlay=""
        placement="bottom start"
        offset={popup === 'over' ? nudge.offset : undefined}
        crossOffset={popup === 'over' ? nudge.crossOffset : undefined}
        shouldFlip={popup !== 'over'}
        {...portalProps}
      >
        {popup === 'over' && (
          <AlignOverTrigger
            triggerRef={triggerRef}
            pressRef={pressRef}
            applied={nudge}
            onMeasure={setNudge}
          />
        )}
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

type Nudge = { offset: number; crossOffset: number };

/** Where and when the pointer went down on the trigger. */
type Press = { x: number; y: number; at: number };

/** How long a press may last and how far it may travel and still be a click. */
const CLICK_MS = 500;
const CLICK_SLOP = 4;

const NO_NUDGE: Nudge = { offset: 0, crossOffset: 0 };

/** React Aria's own resting place for a popover: hanging under its trigger. */
const BELOW: Nudge = { offset: 8, crossOffset: 0 };

/**
 * Lands the list so its selected row covers the trigger: same text column,
 * same line. The shift is handed back as the popover's own `offset` and
 * `crossOffset` rather than a transform, so React Aria keeps owning the
 * position and still holds the list inside the viewport.
 *
 * Measuring needs the list rendered, and the correction is applied by setting
 * state from a layout effect — React finishes that pass before the browser
 * paints, so the list is never seen at the uncorrected position.
 */
function AlignOverTrigger({
  triggerRef,
  pressRef,
  applied,
  onMeasure,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  pressRef: RefObject<Press | null>;
  applied: Nudge;
  onMeasure: (next: Nudge) => void;
}) {
  // React Aria positions the popover but hands out no ref to it, so the
  // element is reached from inside: this marker's own parent.
  const markerRef = useRef<HTMLSpanElement>(null);
  // A measurement that settles takes two passes — one to place the list, one
  // to confirm. A cap is what keeps a list whose own placement changes its
  // measurement from renegotiating forever.
  const passes = useRef(0);
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const popover = markerRef.current?.closest<HTMLElement>('[data-weasel-overlay]');
    if (!trigger || !popover || passes.current > 3) return;
    const value = trigger.querySelector(`.${s.value}`);
    // Nothing chosen yet, so there is no row that belongs over the trigger —
    // and putting an arbitrary one under the pointer arms it. A select showing
    // its placeholder hangs its list below, like any other dropdown.
    const label = popover.querySelector(`[data-selected] .${s.optionLabel}`);
    if (!value || !label) {
      if (applied.offset !== BELOW.offset || applied.crossOffset !== BELOW.crossOffset)
        onMeasure(BELOW);
      return;
    }

    // The trigger's own text alignment decides which edge the two labels are
    // matched on, and the list follows it so the selected row reads as the
    // trigger with the others unfolded around it.
    const align = getComputedStyle(trigger).getPropertyValue('--wzl-select-align').trim();
    const toEnd = align === 'right' || align === 'end';
    popover.dataset.align = toEnd ? 'end' : 'start';

    // Stated against each element's own box rather than measured as a gap to
    // close: React Aria repositions after this effect, so what is on screen
    // now is a frame behind, and a correction read off it would be applied to
    // a position that has already moved — the shift compounds every pass.
    // `bottom start` puts the list's top at the trigger's bottom and their
    // left edges together, so the two insets below are the whole story.
    const box = popover.getBoundingClientRect();
    const seat = trigger.getBoundingClientRect();
    const row = label.getBoundingClientRect();
    const shown = value.getBoundingClientRect();
    const next = {
      offset:
        shown.top + shown.height / 2 - seat.top - (row.top + row.height / 2 - box.top) - seat.height,
      crossOffset: toEnd
        ? shown.right - seat.left - (row.right - box.left)
        : shown.left - seat.left - (row.left - box.left),
    };
    if (Math.abs(next.offset - applied.offset) < 0.5 && Math.abs(next.crossOffset - applied.crossOffset) < 0.5)
      return;
    passes.current += 1;
    onMeasure(next);
  });

  // The list covers the trigger, so the release that ends the click opening it
  // lands on a row — and a row selects on release, which shuts the list again
  // before it has been seen. A click is a press and a release in the same
  // place: that one is the opening gesture and belongs to the trigger, and the
  // list keeps every release after it. Press, hold, drag and release still
  // picks a row, which is the gesture a list over its trigger is for.
  useEffect(() => {
    const doc = triggerRef.current?.ownerDocument;
    if (!doc) return;
    const onUp = (e: PointerEvent) => {
      doc.removeEventListener('pointerup', onUp, true);
      const press = pressRef.current;
      if (!press || performance.now() - press.at > CLICK_MS) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP) return;
      e.preventDefault();
      e.stopPropagation();
    };
    doc.addEventListener('pointerup', onUp, true);
    return () => doc.removeEventListener('pointerup', onUp, true);
  }, [triggerRef, pressRef]);

  return <span ref={markerRef} hidden />;
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
      {/* A box around the label, not just text: landing the list over its
          trigger means measuring where this row's label sits. */}
      <span className={s.optionLabel}>{children}</span>
    </RACListBoxItem>
  );
}
