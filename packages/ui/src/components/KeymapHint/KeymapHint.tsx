import { useId } from 'react';
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
 * then Escape, then each binding and what it does. While no keymap is open it
 * is an empty live region, kept mounted so the keys are announced when they
 * appear. Mount it inside the canvas's input scope.
 */
export function KeymapHint({ className }: KeymapHintProps) {
  const open = useOpenKeymap();
  const titleId = useId();
  return (
    <div role="status" aria-labelledby={open ? titleId : undefined} className={className}>
      {open && (
        <div className={s.hint}>
          <div id={titleId} className={s.title}>{open.label}</div>
          <ul className={s.rows}>
            {open.rows.map((row, i) => (
              <li key={i} className={s.row}>
                {row.shortcut
                  ? <ShortcutKeys shortcut={row.shortcut} className={s.keys} />
                  : <span className={s.gesture}>{row.gesture}</span>}
                <span className={s.label}>{row.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
