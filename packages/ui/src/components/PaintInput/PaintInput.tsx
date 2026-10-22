import { useCallback, useState, type ReactElement } from 'react';
import {
  getAlpha01,
  isPatternPaint,
  paintAlpha,
  paintWithAlpha,
  solid,
  switchGradientKind,
  toHex8,
  usePaintKind,
  usePaintKinds,
  withAlpha01,
  INHERIT,
  type Inherit,
  type Paint,
  type PaintKind,
  type PaintKindEntry,
} from '@weasel-js/core';
import { Icon } from '../../icons/Icon';
import type { IconRef } from '@weasel-js/icons';
import { icon } from '../../icons.gen';
import { ColorField } from '../ColorField';
import { OpacityRange } from '../ColorField/OpacityRange';
import { GradientEditor } from '../GradientEditor';
import { PatternPicker } from '../PatternPicker';
import { paintPreviewCss } from '../../paintPreview';
import { ToggleBar, type ToggleBarItem } from '../ToggleBar';
import s from './PaintInput.module.css';

/** What a kind with no color of its own seeds from. */
const FALLBACK_COLOR = '#000000ff';

/** The bar's answer for "no paint at all". Not a registered kind, so it is
 *  this control's own segment. */
const NONE = 'none';

/** A solid paint as the one `#rrggbbaa` a color field edits. Its alpha lives
 *  in `opacity`; a hex alpha left in `color` multiplies with it when painted,
 *  so both fold in. */
function solidHex8(paint: Paint): string {
  const hex8 = toHex8((paint as { color: string }).color);
  return withAlpha01(hex8.slice(0, 7), getAlpha01(hex8) * paintAlpha(paint));
}

/** `solid(color)` at the slider's own 1% resolution: the alpha arrives
 *  through a hex channel, which would turn 70% into 0.70196. */
function solidFromField(color: string): Paint {
  const paint = solid(color);
  return paint.opacity === undefined
    ? paint
    : { ...paint, opacity: Math.round(paint.opacity * 100) / 100 };
}

/** A paint's own discriminant. The solid member leaves `kind` off, and an
 *  explicit `null` is the absence of paint rather than an unknown one. */
function kindOf(paint: Paint | Inherit | null | undefined): PaintKind | null {
  if (paint === null) return NONE;
  if (paint === undefined) return null;
  if (paint === INHERIT) return INHERIT;
  return paint.kind ?? 'solid';
}

/** `value` when it is a paint of its own. */
export const ownPaint = (value: Paint | Inherit | null | undefined): Paint | null | undefined =>
  (value === INHERIT ? undefined : value);

function segment(id: string, label: string, ref: IconRef | undefined): ToggleBarItem<PaintKind> {
  return ref
    // Icon-only: the full label stays the accessible name. 14, not 15: a
    // `sm` bar is 17px tall over 1px of padding, so 15 fills the segment box.
    ? { value: id, label: <Icon name={ref} size={14} />, ariaLabel: label }
    : { value: id, label };
}

/** The entry that seeds each segment of the kind bar: one segment per family,
 *  seeded by its first member; a kind without a family is its own segment. */
function firstOfSegment(entries: readonly PaintKindEntry[]): Map<string, PaintKindEntry> {
  const firstOf = new Map<string, PaintKindEntry>();
  for (const entry of entries) {
    const id = entry.family?.id ?? entry.id;
    if (!firstOf.has(id)) firstOf.set(id, entry);
  }
  return firstOf;
}

function segmentItems(
  firstOf: ReadonlyMap<string, PaintKindEntry>, allowNone: boolean, allowInherit: boolean,
): readonly ToggleBarItem<PaintKind>[] {
  return [
    ...(allowNone ? [segment(NONE, 'None', icon('core:paintNone'))] : []),
    ...(allowInherit ? [segment(INHERIT, 'Inherit', undefined)] : []),
    ...[...firstOf].map(([id, entry]) => segment(
      id, entry.family?.label ?? entry.label, entry.family ? entry.family.icon : entry.icon,
    )),
  ];
}

/** An "Inherit" choice for a paint control: what it paints, and what picking it does. */
export interface PaintInherit {
  /** `null` for none, `undefined` where that is not one paint. */
  paint: Paint | null | undefined;
  onInherit: () => void;
}

/** Props for {@link PaintInput}. `onInput` fires throughout a gesture and
 *  `onChange` once at its end. */
export interface PaintInputProps {
  /** The paint being edited. `null` is an explicit "no paint"; `undefined`
   *  is no value to show; `'inherit'` takes the enclosing container's. */
  value: Paint | Inherit | null | undefined;
  /** Present, "Inherit" is offered beside "None". */
  inherit?: PaintInherit;
  /** Indeterminate presentation: no kind lit, and the body withheld because
   *  there is no single paint to show. */
  mixed?: boolean;
  /** Dim the control — a value is in effect but was never chosen. */
  unset?: boolean;
  /** Restrict the kind bar. Default: every registered kind. */
  kinds?: readonly PaintKind[];
  /** Offer "None". Default `true`. Turn it off where the slot cannot express
   *  absence. */
  allowNone?: boolean;
  /** What the control is pointed at: a selection key, a node id. Switching
   *  kinds brings back the paint last seen for that kind, and that memory is
   *  dropped when this changes, so one subject is never offered another's
   *  paints. Leave it off for a control that only ever edits one thing. */
  subject?: string | number;
  onInput?: (next: Paint | null) => void;
  onChange: (next: Paint | null) => void;
  /** Names the paint this control edits — `Fill`, `Color`. Carried by the
   *  solid body's swatch, which is the part with a value to announce. */
  'aria-label'?: string;
  className?: string;
}

/**
 * Editor for a whole `Paint` — a kind bar over whichever body that kind
 * wants. The bar is driven by the paint-kind registry, so a consumer's
 * registered kind appears in it and renders that entry's `Editor`. Kinds
 * sharing a `family` are one segment, and that segment's body picks the member.
 *
 * Geometry is deliberately absent — on a canvas it belongs on the artwork,
 * via `<SceneGradientHandles>`.
 */
export function PaintInput(props: PaintInputProps): ReactElement {
  const {
    value: given, mixed = false, unset = false, kinds, allowNone = true,
    subject, onInput, onChange, className,
  } = props;
  const inheriting = given === INHERIT;
  const value = ownPaint(given);
  const { inherit } = props;
  const ariaLabel = props['aria-label'];

  // Per-segment memory, so linear → solid → linear comes back with its stops.
  const [held, setHeld] = useState(() => ({ subject, kinds: new Map<PaintKind, Paint>() }));
  let memory = held;
  if (held.subject !== subject) {
    memory = { subject, kinds: new Map() };
    setHeld(memory);
  }
  const remembered = memory.kinds;

  const valueKind = usePaintKind(value?.kind);
  const entries = usePaintKinds().filter(
    (entry) => kinds === undefined || kinds.includes(entry.id),
  );
  // A paint lights its family's segment when its kind has one.
  const ownKind = kindOf(given);
  const active = mixed || ownKind === null ? null : valueKind?.family?.id ?? ownKind;
  if (value != null && active !== null) remembered.set(active, value);
  const firstOf = firstOfSegment(entries);
  const items = segmentItems(firstOf, allowNone, inherit !== undefined);

  /** The color a switch seeds from: whatever the current paint shows. */
  const shown = inheriting ? inherit?.paint : value;
  const shownKind = usePaintKind(shown?.kind);
  const currentColor = useCallback((): string => {
    if (shown == null) return FALLBACK_COLOR;
    return shownKind?.colorOf(shown) ?? FALLBACK_COLOR;
  }, [shown, shownKind]);

  const switchKind = (kind: PaintKind): void => {
    if (kind === active) return;
    if (kind === NONE) {
      onChange(null);
      return;
    }
    if (kind === INHERIT) {
      inherit?.onInherit();
      return;
    }
    const seen = remembered.get(kind);
    if (seen !== undefined) {
      onChange(seen);
      return;
    }
    const converted = value != null ? switchGradientKind(value, kind) : undefined;
    if (converted !== undefined) {
      onChange(converted);
      return;
    }
    const entry = firstOf.get(kind);
    if (entry) onChange(entry.seed(currentColor()));
  };

  return (
    <div
      className={[s.root, unset && s.unset, className].filter(Boolean).join(' ')}
      title={unset ? 'Not set' : undefined}
    >
      <ToggleBar<PaintKind>
        items={items}
        value={active}
        size="sm"
        ariaLabel="Paint kind"
        onChange={(kind) => kind && switchKind(kind)}
      />
      {!mixed && inheriting ? <InheritedSwatch paint={inherit?.paint} /> : (
        <PaintBody
          value={value}
          mixed={mixed}
          valueKind={valueKind}
          currentColor={currentColor}
          onInput={onInput}
          onChange={onChange}
          ariaLabel={ariaLabel}
        />
      )}
    </div>
  );
}

/** Props for {@link PaintBody}: what {@link PaintInput} shows under its kind bar. */
interface PaintBodyProps {
  value: Paint | null | undefined;
  mixed: boolean;
  valueKind: ReturnType<typeof usePaintKind>;
  /** The color a pattern seeds from. */
  currentColor: () => string;
  onInput?: (next: Paint | null) => void;
  onChange: (next: Paint | null) => void;
  ariaLabel?: string;
}

/** The editor for whichever kind the bar has lit. */
function PaintBody(props: PaintBodyProps): ReactElement | null {
  const { value, mixed, valueKind, currentColor, onInput, onChange, ariaLabel } = props;
  return renderBody();

  /** A solid's alpha rides its swatch; every other kind has no one color to
   *  carry it, so its `opacity` gets the same slider under the body. */
  function withOpacity(paint: Paint, body: ReactElement): ReactElement {
    return (
      <>
        {body}
        <div className={s.opacity}>
          <OpacityRange
            value={paintAlpha(paint)}
            aria-label={ariaLabel}
            onInput={(a01) => onInput?.(paintWithAlpha(paint, a01))}
            onChange={(a01) => onChange(paintWithAlpha(paint, a01))}
          />
        </div>
      </>
    );
  }

  function renderBody(): ReactElement | null {
    if (mixed || value === undefined) {
      return (
        <ColorField
          mixed
          aria-label={ariaLabel}
          onChange={(color) => onChange(solidFromField(color))}
        />
      );
    }
    // Absence has nothing to edit. The lit segment is the whole statement.
    if (value === null) return null;
    // A registered `Editor` wins even for a built-in id: re-registering one is
    // how a consumer replaces a kit control.
    if (valueKind?.Editor) {
      const Editor = valueKind.Editor;
      return withOpacity(value, <Editor value={value} onInput={onInput} onChange={onChange} />);
    }
    if (valueKind?.stopsOf) {
      return withOpacity(value, (
        <GradientEditor
          value={value}
          kindSwitch={false}
          onInput={onInput}
          onChange={onChange}
        />
      ));
    }
    if (isPatternPaint(value)) {
      return withOpacity(
        value,
        <PatternPicker value={value} color={currentColor()} onChange={onChange} />,
      );
    }
    const kind = kindOf(value);
    if (kind !== 'solid') {
      // Editing a paint this control cannot represent would overwrite it, so
      // a kind with no editor is shown and left alone.
      return <div className={s.noEditor}>{valueKind?.label ?? kind}: no editor</div>;
    }
    return (
      <ColorField
        value={solidHex8(value)}
        alpha
        aria-label={ariaLabel}
        onInput={(color) => onInput?.(solidFromField(color))}
        onChange={(color) => onChange(solidFromField(color))}
      />
    );
  }
}

/** What an inheriting paint shows: the container's paint, which is edited there. */
function InheritedSwatch({ paint }: { paint: Paint | null | undefined }): ReactElement {
  const preview = paintPreviewCss(paint);
  const name = paint === undefined ? 'Inherits mixed paints'
    : paint === null ? 'Inherits no paint'
      : `Inherits ${paint.kind === undefined || paint.kind === 'solid' ? (paint as { color: string }).color : paint.kind}`;
  return (
    <span
      className={s.inherited}
      role="img"
      aria-label={name}
      title={name}
      {...(preview ? { style: { background: preview } } : { 'data-empty': '' })}
    />
  );
}
