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
  /** Swap face/glyph colors for emphasis (dark chip on light surface).
   *  Used by `KeySequence` to mark optional keys. Ignored when
   *  `variant === 'minimal'`. */
  inverted?: boolean;
  /** Visual style. `'default'` (default) renders a filled chip; `'minimal'`
   *  renders an unfilled chip whose border and legend are `currentColor`
   *  — useful inline in colored prose / next to colored badges where the
   *  chip should take the surrounding text color. */
  variant?: KeyCapVariant;
  className?: string;
}

/** Single bordered keycap chip for one glyph (modifier or key). Use
 *  `KeySequence` to render a full shortcut. */
export function KeyCap({ label, inverted = false, variant = 'default', className }: KeyCapProps) {
  return (
    <kbd
      className={[s.key, className].filter(Boolean).join(' ')}
      data-kind={inferKeycapKind(label)}
      data-variant={variant === 'default' ? undefined : variant}
      data-inverted={variant === 'minimal' ? undefined : (inverted || undefined)}
    >
      {label}
    </kbd>
  );
}
