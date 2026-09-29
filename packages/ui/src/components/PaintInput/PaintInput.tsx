import { useCallback, useRef, type ReactElement } from 'react';
import {
  getAlpha01,
  getPaintKind,
  paintAlpha,
  paintWithAlpha,
  solid,
  switchGradientKind,
  toHex8,
  usePaintKind,
  usePaintKinds,
  withAlpha01,
  type FillStyle,
  type PaintKind,
} from '@weasel-js/core';
import { Icon } from '../../icons/Icon';
import { ICON_PATHS, type IconName } from '../../icons/paths';
import { ColorField } from '../ColorField';
import { OpacityRange } from '../ColorField/OpacityRange';
import { GradientEditor } from '../GradientEditor';
import { PatternPicker, type PatternFill } from '../PatternPicker';
import { ToggleBar, type ToggleBarItem } from '../ToggleBar';
import s from './PaintInput.module.css';

/** What a kind with no color of its own seeds from. */
const FALLBACK_COLOR = '#000000ff';

/** The bar's answer for "no paint at all". Not a registered kind — absence
 *  has no seed, no color and nothing to render — so it is this control's own
 *  segment rather than a registry entry. */
const NONE = 'none';

/** A solid paint as the one `#rrggbbaa` a color field edits. Its alpha lives
 *  in `opacity`; a hex alpha left in `color` multiplies with it when painted,
 *  so both fold in. */
function solidHex8(paint: FillStyle): string {
  const hex8 = toHex8((paint as { color: string }).color);
  return withAlpha01(hex8.slice(0, 7), getAlpha01(hex8) * paintAlpha(paint));
}

/** `solid(color)` at the slider's own 1% resolution: the alpha arrives
 *  through a hex channel, which would turn 70% into 0.70196. */
function solidFromField(color: string): FillStyle {
  const paint = solid(color);
  return paint.opacity === undefined
    ? paint
    : { ...paint, opacity: Math.round(paint.opacity * 100) / 100 };
}

function isPattern(paint: FillStyle | undefined): paint is PatternFill {
  return paint?.fill === 'pattern';
}

/** A paint's own discriminant. The solid member leaves `fill` off, and an
 *  explicit `null` is the absence of paint rather than an unknown one. */
function kindOf(paint: FillStyle | null | undefined): PaintKind | null {
  if (paint === null) return NONE;
  if (paint === undefined) return null;
  return paint.fill ?? 'solid';
}

/** Props for {@link PaintInput}. `onInput` fires throughout a gesture and
 *  `onChange` once at its end. */
export interface PaintInputProps {
  /** The paint being edited. `null` is an explicit "no paint"; `undefined`
   *  is no value to show. */
  value: FillStyle | null | undefined;
  /** Indeterminate presentation: no kind lit, and the body withheld because
   *  there is no single paint to show. */
  mixed?: boolean;
  /** Dim the control — a value is in effect but was never chosen. */
  unset?: boolean;
  /** Restrict the kind bar. Default: every registered kind. */
  kinds?: readonly PaintKind[];
  /** Offer "None". Default `true` — the bar answers "what kind of paint is
   *  this?" and no-paint is one of the answers. Turn it off where the slot
   *  cannot express absence. */
  allowNone?: boolean;
  onInput?: (next: FillStyle | null) => void;
  onChange: (next: FillStyle | null) => void;
  /** Names the paint this control edits — `Fill`, `Color`. Carried by the
   *  solid body's swatch, which is the part with a value to announce. */
  'aria-label'?: string;
  className?: string;
}

/**
 * Editor for a whole `FillStyle` — a kind bar over whichever body that kind
 * wants.
 *
 * The bar is driven by the paint-kind registry rather than a fixed list, so a
 * consumer's registered kind appears in it and renders that entry's `Editor`.
 * The five built-in kinds keep their branch here: their editors live in this
 * package and `@weasel-js/core`, which owns the registry, cannot import it.
 *
 * Geometry is deliberately absent — on a canvas it belongs on the artwork,
 * via `<SceneGradientHandles>`.
 */
export function PaintInput(props: PaintInputProps): ReactElement {
  const {
    value, mixed = false, unset = false, kinds, allowNone = true,
    onInput, onChange, className,
  } = props;
  const ariaLabel = props['aria-label'];

  // Per-kind memory, so linear → solid → linear comes back with its stops.
  // A ref, not state: it must not survive the control being pointed at a
  // different selection, and nothing renders off it directly.
  const remembered = useRef(new Map<PaintKind, FillStyle>());

  const active = mixed ? null : kindOf(value);
  if (value != null && active !== null) remembered.current.set(active, value);

  const valueKind = usePaintKind(value?.fill);
  const entries = usePaintKinds().filter(
    (entry) => kinds === undefined || kinds.includes(entry.id),
  );
  const segment = (id: string, label: string, icon: string | undefined): ToggleBarItem<PaintKind> =>
    icon && icon in ICON_PATHS
      // Icon-only: six labelled segments do not fit a property row, and the
      // full label stays the accessible name.
      // 14 to match the panel's other glyph segments. A `sm` bar is 17px tall
      // over 1px of padding, so 15 fills the segment box edge to edge.
      ? { value: id, label: <Icon name={icon as IconName} size={14} />, ariaLabel: label }
      : { value: id, label };

  const items: readonly ToggleBarItem<PaintKind>[] = [
    ...(allowNone ? [segment(NONE, 'None', 'paintNone')] : []),
    ...entries.map((entry) => segment(entry.id, entry.label, entry.icon)),
  ];

  /** The color a switch seeds from: whatever the current paint shows. */
  const currentColor = useCallback((): string => {
    if (value == null) return FALLBACK_COLOR;
    return valueKind?.colorOf(value) ?? FALLBACK_COLOR;
  }, [value, valueKind]);

  const switchKind = (kind: PaintKind): void => {
    if (kind === active) return;
    if (kind === NONE) {
      onChange(null);
      return;
    }
    const seen = remembered.current.get(kind);
    if (seen !== undefined) {
      onChange(seen);
      return;
    }
    const converted = value != null ? switchGradientKind(value, kind) : undefined;
    if (converted !== undefined) {
      onChange(converted);
      return;
    }
    const entry = getPaintKind(kind);
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
      {renderBody()}
    </div>
  );

  /** A solid's alpha rides its swatch; every other kind has no one color to
   *  carry it, so its `opacity` gets the same slider under the body. */
  function withOpacity(paint: FillStyle, body: ReactElement): ReactElement {
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
    // how a consumer replaces a kit control, and the built-in branches below
    // are the fallback for the ids that ship without an entry editor.
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
    if (isPattern(value)) {
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
