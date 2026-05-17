import s from './Keycaps.module.css';
import { Keycap } from './Keycap';

export interface KeycapsProps {
  /** One glyph or label per chip (modifiers first, then the key). `undefined`
   *  or empty renders as a muted em-dash. */
  parts: readonly string[] | undefined;
  className?: string;
}

/** Renders a shortcut as a row of `<Keycap>` chips. */
export function Keycaps({ parts, className }: KeycapsProps) {
  if (!parts || parts.length === 0) {
    return <span className={[s.keysEmpty, className].filter(Boolean).join(' ')}>—</span>;
  }
  return (
    <span className={[s.keys, className].filter(Boolean).join(' ')}>
      {parts.map((p, i) => (
        <Keycap key={i}>{p}</Keycap>
      ))}
    </span>
  );
}
