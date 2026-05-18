import { Fragment } from 'react';
import s from './Keycaps.module.css';
import { KeyCap, inferKeycapKind } from './Keycap';

export interface KeySpec {
  /** Glyph rendered in the chip (modifier or key). */
  label: string;
  /** When true, the chip renders inverted to mark it as not required to
   *  trigger the action (e.g. an optional modifier). Defaults to false. */
  optional?: boolean;
}

export interface KeySequenceProps {
  /** Keys to render. `undefined` or empty renders a muted em-dash.
   *  Modifiers are always rendered first regardless of input order; relative
   *  order within each group is preserved. */
  keys: readonly KeySpec[] | undefined;
  /** Character inserted between the trailing modifier chip and the first
   *  non-modifier chip (e.g. `'+'` renders `⌘ + K`). `null` or `''`
   *  suppresses it. Defaults to `'+'`. */
  separator?: string | null;
  className?: string;
}

/** Renders a shortcut as a row of `KeyCap` chips, one per key. Optional
 *  keys render inverted to distinguish them from required ones. */
export function KeySequence({ keys, separator = '+', className }: KeySequenceProps) {
  if (!keys || keys.length === 0) {
    return <span className={[s.keysEmpty, className].filter(Boolean).join(' ')}>—</span>;
  }
  const ordered = keys
    .map((k, i) => ({ k, i }))
    .sort((a, b) => {
      const am = inferKeycapKind(a.k.label) === 'modifier' ? 0 : 1;
      const bm = inferKeycapKind(b.k.label) === 'modifier' ? 0 : 1;
      return am - bm || a.i - b.i;
    })
    .map(({ k }) => k);
  const sepIdx = ordered.findIndex((k) => inferKeycapKind(k.label) !== 'modifier');
  const showSep = !!separator && sepIdx > 0 && sepIdx < ordered.length;
  return (
    <span className={[s.keys, className].filter(Boolean).join(' ')}>
      {ordered.map((k, i) => (
        <Fragment key={i}>
          {showSep && i === sepIdx ? <span className={s.sep}>{separator}</span> : null}
          <KeyCap label={k.label} inverted={k.optional ?? false} />
        </Fragment>
      ))}
    </span>
  );
}
