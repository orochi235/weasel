import type { ReactNode } from 'react';
import s from './Keycaps.module.css';

const MODIFIER_GLYPHS = new Set(['⌘', '⇪', '⌥', '⌃', '⇧']);
const WIDE_GLYPHS = new Set(['⇥', '↵', '␣']);

export type KeycapKind = 'modifier' | 'wide' | 'square';

function inferKind(label: ReactNode): KeycapKind {
  if (typeof label !== 'string') return 'square';
  if (MODIFIER_GLYPHS.has(label)) return 'modifier';
  if (WIDE_GLYPHS.has(label)) return 'wide';
  if (label.length > 1) return 'wide';
  return 'square';
}

export interface KeycapProps {
  children: ReactNode;
  /** Override the auto-detected chip width class. */
  kind?: KeycapKind;
  className?: string;
}

/** A single bordered keycap chip. Width is auto-inferred from the label
 *  (modifier glyphs widen, multi-char labels widen, single glyphs stay
 *  square) unless `kind` is set explicitly. */
export function Keycap({ children, kind, className }: KeycapProps) {
  const resolved = kind ?? inferKind(children);
  return (
    <kbd className={[s.key, className].filter(Boolean).join(' ')} data-kind={resolved}>
      {children}
    </kbd>
  );
}
