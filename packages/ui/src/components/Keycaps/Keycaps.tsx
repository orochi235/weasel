import { Fragment } from 'react';
import s from './Keycaps.module.css';
import { KeyCap, inferKeycapKind, type KeyCapVariant } from './Keycap';

/** One key in a shortcut. */
export interface KeySpec {
  /** Glyph rendered in the chip (modifier or key). */
  label: string;
  /** When true, the chip renders inverted to mark it as not required to
   *  trigger the action (e.g. an optional modifier). Defaults to false. */
  optional?: boolean;
}

/** Where {@link KeySequence} draws its separator. */
export type KeySequenceJoins = 'all' | 'key' | 'none';

/** Props for {@link KeySequence}. */
export interface KeySequenceProps {
  /** Keys to render. `undefined` or empty renders a muted em-dash.
   *  Modifiers are always rendered first regardless of input order; relative
   *  order within each group is preserved. */
  keys: readonly KeySpec[] | undefined;
  /** Glyph drawn wherever {@link joins} places a separator. Defaults to `'+'`. */
  separator?: string;
  /** Where the separator goes. Defaults to `'key'`.
   *  - `'all'`: between every pair of chips — `⌘ + ⇧ + K`, `⌘ + ⇧`, `A + B`.
   *  - `'key'`: before every non-modifier — `⌘ ⇧ + K`, `⌘ + K + L`, `A + B`.
   *    Modifiers stay unjoined, so `⌘ ⇧` gets none.
   *  - `'none'`: never. */
  joins?: KeySequenceJoins;
  /** Forwarded to every `KeyCap` in the sequence. `'minimal'` renders
   *  unfilled chips whose border + legend are `currentColor`. */
  variant?: KeyCapVariant;
  /** Forwarded to every `KeyCap` in the sequence. Overrides the design-
   *  system UI font for that chip only. */
  font?: string;
  className?: string;
}

/** Renders a shortcut as a row of `KeyCap` chips, one per key. Optional
 *  keys render inverted to distinguish them from required ones. */
export function KeySequence({ keys, separator = '+', joins = 'key', variant = 'default', font, className }: KeySequenceProps) {
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
  const sepBefore = (i: number): boolean =>
    i > 0 &&
    (joins === 'all' || (joins === 'key' && inferKeycapKind(ordered[i]!.label) !== 'modifier'));
  return (
    <span className={[s.keys, className].filter(Boolean).join(' ')}>
      {ordered.map((k, i) => (
        <Fragment key={i}>
          {sepBefore(i) ? <span className={s.sep}>{separator}</span> : null}
          <KeyCap label={k.label} inverted={k.optional ?? false} variant={variant} font={font} />
        </Fragment>
      ))}
    </span>
  );
}
