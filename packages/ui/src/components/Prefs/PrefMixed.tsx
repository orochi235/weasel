import s from './PrefMixed.module.css';

/** What every params surface draws in place of a `list` or `map` leaf's editor where the values it stands for differ. */
export function PrefMixed() {
  return <span className={s.mixed}>Mixed</span>;
}
