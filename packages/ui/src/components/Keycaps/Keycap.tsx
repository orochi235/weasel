import type { CSSProperties } from 'react';
import s from './Keycaps.module.css';

const MODIFIER_GLYPHS = new Set(['⌘', '⇪', '⌥', '⌃', '⇧']);
const WIDE_GLYPHS = new Set(['⇥', '↵', '␣']);

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
  if (MODIFIER_GLYPHS.has(label)) return 'modifier';
  if (WIDE_GLYPHS.has(label)) return 'wide';
  if (label.length > 1) return 'wide';
  return 'square';
}

/** Visual style of a keycap chip. */
export type KeyCapVariant = 'default' | 'minimal';

/** Props for {@link KeyCap}. */
export interface KeyCapProps {
  /** Glyph rendered in the chip (modifier or key). */
  label: string;
  /** Marks the chip as not required to trigger the action. In the default
   *  variant the chip face inverts (dark face / light glyph) for
   *  emphasis. In the `'minimal'` variant the chip's border becomes
   *  dotted to read as "may be held, but isn't required." */
  inverted?: boolean;
  /** Visual style. `'default'` (default) renders a filled chip; `'minimal'`
   *  renders an unfilled chip whose border and legend are `currentColor`
   *  — useful inline in colored prose / next to colored badges where the
   *  chip should take the surrounding text color. */
  variant?: KeyCapVariant;
  className?: string;
  /** Optional inline style. Useful for one-off width overrides (e.g.
   *  building a keyboard-layout where the space bar spans several
   *  standard-key widths). The component sets no inline styles of its
   *  own — everything else comes from the CSS module. */
  style?: CSSProperties;
  /** Override the chip's font-family. Accepts any CSS font-family
   *  string. When omitted, the chip inherits from the design-system
   *  UI font token (`--wzl-font-ui`). Useful for one-off cases where
   *  a different face is desired — though the canonical move is to
   *  override the CSS variable at the consumer's scope, not the prop. */
  font?: string;
}

/** Single bordered keycap chip for one glyph (modifier or key). Use
 *  `KeySequence` to render a full shortcut. */
export function KeyCap({ label, inverted = false, variant = 'default', className, style, font }: KeyCapProps) {
  const resolvedStyle = font ? { ...style, fontFamily: font } : style;
  return (
    <kbd
      className={[s.key, className].filter(Boolean).join(' ')}
      data-kind={inferKeycapKind(label)}
      data-variant={variant === 'default' ? undefined : variant}
      data-inverted={inverted || undefined}
      style={resolvedStyle}
    >
      {label}
    </kbd>
  );
}
