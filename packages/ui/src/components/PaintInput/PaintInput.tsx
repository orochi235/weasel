import { useCallback, useRef, type ReactElement } from 'react';
import {
  getPaintKind,
  listPaintKinds,
  withGradientKind,
  type FillStyle,
  type GradientFill,
  type GradientKind,
  type PaintKind,
} from '@weasel-js/core';
import { Icon } from '../../icons/Icon';
import { ICON_PATHS, type IconName } from '../../icons/paths';
import { ColorField } from '../ColorField';
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

const GRADIENT_KINDS: readonly string[] = [
  'linear-gradient',
  'radial-gradient',
  'conic-gradient',
];

function isGradient(paint: FillStyle | undefined): paint is GradientFill {
  return paint !== undefined && GRADIENT_KINDS.includes(paint.fill ?? '');
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

  const entries = listPaintKinds().filter(
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
    return getPaintKind(kindOf(value) ?? 'solid')?.colorOf(value) ?? FALLBACK_COLOR;
  }, [value]);

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
    if (value != null && isGradient(value) && GRADIENT_KINDS.includes(kind)) {
      onChange(withGradientKind(value, kind as GradientKind));
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

  function renderBody(): ReactElement | null {
    if (mixed || value === undefined) {
      return (
        <ColorField
          mixed
          aria-label={ariaLabel}
          onChange={(color) => onChange({ fill: 'solid', color })}
        />
      );
    }
    // Absence has nothing to edit. The lit segment is the whole statement.
    if (value === null) return null;
    // A registered `Editor` wins even for a built-in id: re-registering one is
    // how a consumer replaces a kit control, and the built-in branches below
    // are the fallback for the ids that ship without an entry editor.
    const entry = getPaintKind(kindOf(value) ?? 'solid');
    if (entry?.Editor) {
      const Editor = entry.Editor;
      return <Editor value={value} onInput={onInput} onChange={onChange} />;
    }
    if (isGradient(value)) {
      return (
        <GradientEditor
          value={value}
          kindSwitch={false}
          onInput={onInput}
          onChange={onChange}
        />
      );
    }
    if (isPattern(value)) {
      return <PatternPicker value={value} color={currentColor()} onChange={onChange} />;
    }
    return (
      <ColorField
        value={currentColor()}
        alpha
        aria-label={ariaLabel}
        onInput={(color) => onInput?.({ fill: 'solid', color })}
        onChange={(color) => onChange({ fill: 'solid', color })}
      />
    );
  }
}
