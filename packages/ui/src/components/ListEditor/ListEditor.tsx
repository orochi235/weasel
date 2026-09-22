import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '../Button';
import s from './ListEditor.module.css';

/** Props for {@link ListEditor}. */
export interface ListEditorProps {
  value: readonly string[];
  /** Every edit, add and removal, with the whole list. Entries are written as
   *  typed — an empty one stays until it is removed. */
  onChange: (next: string[]) => void;
  /** Shown in an empty entry. */
  placeholder?: string;
  /** Shown in place of the entries when there are none. */
  empty?: string;
  /** Text of the add button. */
  addLabel?: string;
  /** Names the list for assistive tech; each entry is named from it. */
  'aria-label'?: string;
  className?: string;
}

/**
 * An editable list of strings: one field per entry, a remove button beside
 * each, and an add button under them. Enter in an entry adds one after it;
 * Backspace in an empty one removes it.
 */
export function ListEditor({
  value,
  onChange,
  placeholder,
  empty = 'None',
  addLabel = 'Add',
  'aria-label': ariaLabel,
  className,
}: ListEditorProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [focus, setFocus] = useState<number | null>(null);

  useEffect(() => {
    if (focus === null) return;
    inputs.current[focus]?.focus();
    setFocus(null);
  }, [focus]);

  const insert = (at: number): void => {
    onChange([...value.slice(0, at), '', ...value.slice(at)]);
    setFocus(at);
  };
  const remove = (at: number): void => {
    onChange(value.filter((_, i) => i !== at));
    if (value.length > 1) setFocus(Math.max(0, at - 1));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, at: number): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      insert(at + 1);
    } else if (e.key === 'Backspace' && value[at] === '') {
      e.preventDefault();
      remove(at);
    }
  };
  const name = (i: number): string => `${ariaLabel ?? 'Entry'} ${i + 1}`;

  return (
    <div className={[s.editor, className].filter(Boolean).join(' ')} role="group" aria-label={ariaLabel}>
      {value.length === 0 ? (
        <div className={s.empty}>{empty}</div>
      ) : (
        <ul className={s.list}>
          {value.map((entry, i) => (
            // Entries have no identity beyond their position, and two may be equal.
            <li key={i} className={s.entry}>
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                type="text"
                className={s.input}
                aria-label={name(i)}
                value={entry}
                placeholder={placeholder}
                onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
                onKeyDown={(e) => onKeyDown(e, i)}
              />
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                ariaLabel={`Remove ${name(i)}`}
                onClick={() => remove(i)}
              >
                ×
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className={s.actions}>
        <Button size="sm" onClick={() => insert(value.length)}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
