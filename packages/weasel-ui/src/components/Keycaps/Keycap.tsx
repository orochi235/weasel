import type { CSSProperties } from 'react';
import s from './Keycaps.module.css';

const MODIFIER_GLYPHS = new Set(['⌘', '⇪', '⌥', '⌃', '⇧']);
const WIDE_GLYPHS = new Set(['⇥', '↵', '␣']);

export type KeycapKind = 'modifier' | 'wide' | 'square';

export function inferKeycapKind(label: string): KeycapKind {
  if (MODIFIER_GLYPHS.has(label)) return 'modifier';
  if (WIDE_GLYPHS.has(label)) return 'wide';
  if (label.length > 1) return 'wide';
  return 'square';
}

export type KeyCapVariant = 'default' | 'minimal';

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
}

/** Single bordered keycap chip for one glyph (modifier or key). Use
 *  `KeySequence` to render a full shortcut. */
export function KeyCap({ label, inverted = false, variant = 'default', className, style }: KeyCapProps) {
  return (
    <kbd
      className={[s.key, className].filter(Boolean).join(' ')}
      data-kind={inferKeycapKind(label)}
      data-variant={variant === 'default' ? undefined : variant}
      data-inverted={inverted || undefined}
      style={style}
    >
      {label}
    </kbd>
  );
}
