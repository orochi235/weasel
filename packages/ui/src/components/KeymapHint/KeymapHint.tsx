import { useId } from 'react';
import { formatShortcut } from '@weasel-js/gestures';
import { useOpenKeymap } from '@weasel-js/core';
import { ShortcutKeys } from '../Keycaps/ShortcutKeys';
import s from './KeymapHint.module.css';

/** Props for {@link KeymapHint}. */
export interface KeymapHintProps {
  /** Additional class for the root, to place it. Where it docks is the host's choice. */
  className?: string;
}

/**
 * The keys of the keymap open on the canvas in scope, while one is: its label,
 * then Escape, then each binding and what it does. Renders nothing while no
 * keymap is open. Mount it inside the canvas's input scope.
 */
export function KeymapHint({ className }: KeymapHintProps) {
  const open = useOpenKeymap();
  const titleId = useId();
  if (!open) return null;
  return (
    <div role="status" aria-labelledby={titleId} className={[s.hint, className].filter(Boolean).join(' ')}>
      <div id={titleId} className={s.title}>{open.label}</div>
      <ul className={s.rows}>
        {open.rows.map((row, i) => (
          <li key={i} className={s.row}>
            {row.shortcut
              ? <ShortcutKeys legend={formatShortcut(row.shortcut) ?? ''} className={s.keys} />
              : <span className={s.gesture}>{row.gesture}</span>}
            <span className={s.label}>{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
