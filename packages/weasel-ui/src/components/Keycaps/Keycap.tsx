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

export interface KeyCapProps {
  /** Glyph rendered in the chip (modifier or key). */
  label: string;
  /** Swap face/glyph colors for emphasis (dark chip on light surface).
   *  Used by `KeySequence` to mark optional keys. */
  inverted?: boolean;
  className?: string;
}

/** Single bordered keycap chip for one glyph (modifier or key). Use
 *  `KeySequence` to render a full shortcut. */
export function KeyCap({ label, inverted = false, className }: KeyCapProps) {
  return (
    <kbd
      className={[s.key, className].filter(Boolean).join(' ')}
      data-kind={inferKeycapKind(label)}
      data-inverted={inverted || undefined}
    >
      {label}
    </kbd>
  );
}
