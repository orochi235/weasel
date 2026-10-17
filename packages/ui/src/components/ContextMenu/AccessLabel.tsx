import { accessLetter } from '@weasel-js/menu';
import s from './ContextMenu.module.css';

/** A menu label with the first occurrence of its access letter underlined, as one flex item so its accessible name stays whole. */
export function AccessLabel({ label, access }: { label: string; access?: string }) {
  const letter = accessLetter(access);
  const at = letter ? label.toLowerCase().indexOf(letter) : -1;
  if (at < 0 || !letter) return <span className={s.label}>{label}</span>;
  return (
    <span className={s.label}>
      {label.slice(0, at)}
      <span className={s.access}>{label.slice(at, at + letter.length)}</span>
      {label.slice(at + letter.length)}
    </span>
  );
}
