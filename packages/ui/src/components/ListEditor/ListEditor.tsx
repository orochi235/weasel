import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '../Button';
import { CloseButton } from '../CloseButton';
import f from '../field.module.css';
import s from './ListEditor.module.css';

/** Props for {@link ListEditor}. */
export interface ListEditorProps<T = string> {
  value: readonly T[];
  /** Every edit, add and removal, with the whole list. Entries are written as
   *  typed — an empty one stays until it is removed. */
  onChange: (next: T[]) => void;
  /** Draws one entry's control, named `name` for assistive tech. Without it
   *  the entries are strings, each a text field. */
  renderEntry?: (entry: T, set: (next: T) => void, name: string, index: number) => ReactNode;
  /** What an added entry starts as. */
  newEntry?: () => T;
  /** Entries cannot be removed at this many. */
  minItems?: number;
  /** Entries cannot be added at this many. */
  maxItems?: number;
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

/** {@link ListEditorProps} for entries that are not strings, which have to be drawn and made. */
export type ItemListEditorProps<T> = ListEditorProps<T> &
  Required<Pick<ListEditorProps<T>, 'renderEntry' | 'newEntry'>>;

/**
 * An editable list: one control per entry, a remove button beside each, and
 * an add button under them. Entries are strings in text fields unless
 * `renderEntry` draws them. In a text field, Enter adds an entry after it
 * and Backspace in an empty one removes it.
 */
export function ListEditor(props: ListEditorProps): ReactNode;
export function ListEditor<T>(props: ItemListEditorProps<T>): ReactNode;
export function ListEditor<T>({
  value,
  onChange,
  placeholder,
  empty = 'None',
  addLabel = 'Add',
  'aria-label': ariaLabel,
  className,
  renderEntry,
  newEntry,
  minItems = 0,
  maxItems = Infinity,
}: ListEditorProps<T>) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [focus, setFocus] = useState<number | null>(null);

  useEffect(() => {
    if (focus === null) return;
    inputs.current[focus]?.focus();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consumes a one-shot focus request once its input has committed
    setFocus(null);
  }, [focus]);

  const insert = (at: number): void => {
    if (value.length >= maxItems) return;
    // The overloads leave `newEntry` out only for a list of strings.
    onChange([...value.slice(0, at), newEntry ? newEntry() : ('' as T), ...value.slice(at)]);
    setFocus(at);
  };
  const remove = (at: number): void => {
    if (value.length <= minItems) return;
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
  const set = (at: number, next: T): void => onChange(value.map((v, j) => (j === at ? next : v)));

  return (
    <div className={[s.editor, className].filter(Boolean).join(' ')} role="group" aria-label={ariaLabel}>
      {value.length === 0 ? (
        <div className={s.empty}>{empty}</div>
      ) : (
        <ul className={s.list}>
          {value.map((entry, i) => (
            // Entries have no identity beyond their position, and two may be equal.
            <li key={i} className={s.entry}>
              {renderEntry ? (
                <div className={s.control}>{renderEntry(entry, (next) => set(i, next), name(i), i)}</div>
              ) : (
                <input
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  type="text"
                  className={`${f.frame} ${s.input}`}
                  aria-label={name(i)}
                  value={entry as string}
                  placeholder={placeholder}
                  onChange={(e) => set(i, e.target.value as T)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                />
              )}
              <CloseButton
                ariaLabel={`Remove ${name(i)}`}
                disabled={value.length <= minItems}
                onClick={() => remove(i)}
              />
            </li>
          ))}
        </ul>
      )}
      <div className={s.actions}>
        <Button size="sm" disabled={value.length >= maxItems} onClick={() => insert(value.length)}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
