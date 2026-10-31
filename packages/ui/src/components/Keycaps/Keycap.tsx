import { useRef, type CSSProperties } from 'react';
import { Icon } from '../../icons/Icon';
import type { IconRef } from '@weasel-js/icons';
import { icon } from '../../icons.gen';
import s from './Keycaps.module.css';
import { MODIFIER_LABELS } from '@weasel-js/gestures';
import { useLegendFit } from './useLegendFit';

const WIDE_GLYPHS = new Set(['⇥', '↵', '␣']);
const FUNCTION_KEY = /^F([1-9]|1\d|2[0-4])$/;

/** The icon a symbol legend is drawn as, so it matches its neighbors whatever
 *  font the chip is in. Every symbol the legend tables produce has one. */
const LEGEND_ICONS: Readonly<Record<string, IconRef>> = {
  '⌘': icon('keyCommand'), '⇧': icon('keyShift'), '⌥': icon('keyOption'), '⌃': icon('keyControl'), '⎈': icon('keyHelm'), '⎇': icon('keyAlt'),
  '⎋': icon('keyEscape'), '↵': icon('keyReturn'), '⏎': icon('keyReturn'), '⇥': icon('keyTab'), '␣': icon('keySpace'),
  '⌫': icon('keyBackspace'), '⌦': icon('keyDelete'), '⟵': icon('keyBackspaceArrow'),
  '↑': icon('keyArrowUp'), '↓': icon('keyArrowDown'), '←': icon('keyArrowLeft'), '→': icon('keyArrowRight'),
  '↖': icon('keyHome'), '↘': icon('keyEnd'), '⇞': icon('keyPageUp'), '⇟': icon('keyPageDown'),
  '⎙': icon('keyPrintScreen'), '⎀': icon('keyInsert'), '⇳': icon('keyScrollLock'), '⎉': icon('keyPause'),
  '⊞': icon('keyWindows'), '▤': icon('keyMenu'),
};

/**
 * Width class of a keycap: a modifier glyph, a multi-character legend that
 * needs a wider chip, or a single character in a square one.
 */
export type KeycapKind = 'modifier' | 'wide' | 'square';

/**
 * Picks the chip width for a legend — modifier glyphs and anything longer
 * than one character get the wider forms.
 */
export function inferKeycapKind(label: string): KeycapKind {
  if (label === '⇪' || MODIFIER_LABELS.has(label)) return 'modifier';
  if (WIDE_GLYPHS.has(label)) return 'wide';
  if (label.length > 1) return 'wide';
  return 'square';
}

/** Visual style of a keycap chip. */
export type KeyCapVariant = 'default' | 'inverse';

/** Props for {@link KeyCap}. */
export interface KeyCapProps {
  /** Glyph rendered in the chip (modifier or key). */
  label: string;
  /** Marks the chip as not required to trigger the action: its border
   *  goes dotted, to read as "may be held, but isn't required." In the
   *  `'inverse'` variant the face flips dark and the legend dims too. */
  inverted?: boolean;
  /** Visual style. `'default'` renders an unfilled chip whose border and
   *  legend are `currentColor`, so it takes the surrounding text color;
   *  `'inverse'` renders a filled chip. */
  variant?: KeyCapVariant;
  className?: string;
  /** Optional inline style. Useful for one-off width overrides (e.g.
   *  building a keyboard-layout where the space bar spans several
   *  standard-key widths). The component sets no inline styles of its
   *  own — everything else comes from the CSS module — save one: a key in
   *  a `KeyBank` printing a two-line spelling carries its own
   *  `--key-legend-scale`. */
  style?: CSSProperties;
  /** Override the chip's font-family. Accepts any CSS font-family
   *  string. When omitted, the chip is set in a neutral sans stack rather
   *  than the UI font (`--wzl-font-ui`), so its legends read like real key
   *  legends; a rule on the chip's `className` does the same without an
   *  inline style. */
  font?: string;
  /** Inside a `KeyBank`, lets this key print a two-line spelling,
   *  overriding the bank's `wrap`. No effect outside a bank. */
  wrap?: boolean;
  /** The key's width is set by its layout rather than by its legend. Inside a
   *  `KeyBank` only a fixed key fits its legend to its box; any other prints
   *  its first spelling at the bank's scale. Defaults to true when `style`
   *  gives a `width` or the key is square, whose width the stylesheet fixes. */
  fixed?: boolean;
}

/** Single bordered keycap chip for one glyph (modifier or key). Use
 *  `KeySequence` to render a full shortcut. */
export function KeyCap({ label, inverted = false, variant = 'default', className, style, font, wrap, fixed }: KeyCapProps) {
  const ref = useRef<HTMLElement>(null);
  const kind = inferKeycapKind(label);
  const fit = useLegendFit(ref, label, { wrap, font, fixed: fixed ?? (style?.width !== undefined || kind === 'square') });
  const fitted = fit.scale === undefined ? style : ({ ...style, '--key-legend-scale': String(fit.scale) } as CSSProperties);
  const resolvedStyle = font ? { ...fitted, fontFamily: font } : fitted;
  const glyph = LEGEND_ICONS[fit.label];
  return (
    <kbd
      ref={ref}
      className={[s.key, className].filter(Boolean).join(' ')}
      data-kind={kind}
      data-fn={FUNCTION_KEY.test(label) || undefined}
      data-banked={fit.banked || undefined}
      data-variant={variant === 'default' ? undefined : variant}
      data-inverted={inverted || undefined}
      data-wrapped={fit.wrapped || undefined}
      style={resolvedStyle}
    >
      {glyph ? (
        <>
          <Icon name={glyph} className={s.legendIcon} />
          <span className={s.legendText}>{fit.label}</span>
        </>
      ) : fit.label}
    </kbd>
  );
}
