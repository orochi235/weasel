import { accessLetter } from '@weasel-js/menu';
import { foldText } from '@weasel-js/registry';
import { graphemeEnds } from '@weasel-js/text';
import s from './Menu.module.css';

/** The first cluster of `label` that reads as `letter` folded as `accessLetter` folds it, as [start, end), or null. */
function accessSpan(label: string, letter: string): [number, number] | null {
  let start = 0;
  for (const end of graphemeEnds(label)) {
    if (foldText(label.slice(start, end)) === letter) return [start, end];
    start = end;
  }
  return null;
}

/** A menu label with the first occurrence of its access letter underlined, as one flex item so its accessible name stays whole. */
export function AccessLabel({ label, access, className }: { label: string; access?: string; className?: string }) {
  const cls = className ? `${s.label} ${className}` : s.label;
  const letter = accessLetter(access);
  const span = letter ? accessSpan(label, letter) : null;
  if (!span) return <span className={cls}>{label}</span>;
  const [from, to] = span;
  return (
    <span className={cls}>
      {label.slice(0, from)}
      <span className={s.access}>{label.slice(from, to)}</span>
      {label.slice(to)}
    </span>
  );
}
