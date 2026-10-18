import { useMemo, type KeyboardEvent, type ReactNode } from 'react';
import { useReorderDragList, type ReorderItem } from '../../useReorderDragList';
import { CloseButton } from '../CloseButton';
import { DragGrip } from '../DragGrip';
import f from '../field.module.css';
import { AddEntry, type ListEntryKind } from './AddEntry';
import { movedEntry, useListFocus } from './listFocus';
import s from './ListEditor.module.css';

export type { ListEntryKind };

/** Props for {@link ListEditor}. */
export interface ListEditorProps<T = string> {
  value: readonly T[];
  /** Every edit, add, removal and move, with the whole list. Entries are written as
   *  typed — an empty one stays until it is removed. */
  onChange: (next: T[]) => void;
  /** Draws one entry's control, named `name` for assistive tech. Without it
   *  the entries are strings, each a text field. */
  renderEntry?: (entry: T, set: (next: T) => void, name: string, index: number) => ReactNode;
  /** What an added entry starts as. Several kinds make the add button a menu of them, each by its label. */
  newEntry?: (() => T) | readonly ListEntryKind<T>[];
  /** Entries can be moved: each has a handle to drag, and Alt+Up / Alt+Down anywhere in an entry moves it. */
  reorder?: boolean;
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
  /** The list takes no input: no entry is typed in, added, moved, or removed. A `renderEntry` disables what it draws. */
  disabled?: boolean;
  /** Whether the text field of the entry at `index` takes no typing. The entry can still be removed. */
  entryDisabled?: (index: number) => boolean;
  /** Names the list for assistive tech; each entry is named from it. */
  'aria-label'?: string;
  className?: string;
}

/** {@link ListEditorProps} for entries that are not strings, which have to be drawn and made. */
export type ItemListEditorProps<T> = ListEditorProps<T> &
  Required<Pick<ListEditorProps<T>, 'renderEntry' | 'newEntry'>>;

const isMove = (e: KeyboardEvent): boolean => e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown');

/**
 * An editable list: one control per entry, a remove button beside each, and
 * an add button under them. Entries are strings in text fields unless
 * `renderEntry` draws them. In a text field, Enter adds an entry after it
 * and Backspace in an empty one removes it. With `reorder`, entries move by
 * their handles or Alt+Up / Alt+Down.
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
  reorder = false,
  minItems = 0,
  maxItems = Infinity,
  disabled = false,
  entryDisabled,
}: ListEditorProps<T>) {
  const focus = useListFocus();
  // The overloads leave `newEntry` out only for a list of strings.
  const kinds = useMemo(
    (): readonly ListEntryKind<T>[] =>
      typeof newEntry === 'function' ? [{ label: addLabel, make: newEntry }]
        : newEntry ?? [{ label: addLabel, make: () => '' as T }],
    [newEntry, addLabel],
  );

  const insert = (at: number, make: () => T): void => {
    if (value.length >= maxItems) return;
    onChange([...value.slice(0, at), make(), ...value.slice(at)]);
    focus.request({ at, to: 'input' });
  };
  const remove = (at: number): void => {
    if (value.length <= minItems) return;
    onChange(value.filter((_, i) => i !== at));
    focus.request({ at: Math.max(0, at - 1), to: 'removed' });
  };
  const items = useMemo((): ReorderItem[] => value.map((_, i) => ({ id: String(i), label: '' })), [value]);
  const drag = useReorderDragList({
    items,
    selectedIds: [],
    onReorder: ([id], target) => {
      const from = Number(id);
      onChange(movedEntry(value, from, target));
      focus.request({ at: target > from ? target - 1 : target, to: 'handle' });
    },
  });
  const move = (e: KeyboardEvent, at: number): void => {
    if (!reorder || disabled || !isMove(e)) return;
    e.preventDefault();
    const by = e.key === 'ArrowUp' ? -1 : 1;
    const to = at + by;
    if (to < 0 || to >= value.length) return;
    onChange(movedEntry(value, at, by < 0 ? to : to + 1));
    focus.request({ at: to, to: e.target === focus.inputs.current[at] ? 'input' : 'handle' });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, at: number): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (kinds[0]) insert(at + 1, kinds[0].make);
    } else if (e.key === 'Backspace' && value[at] === '') {
      e.preventDefault();
      remove(at);
    }
  };
  const name = (i: number): string => `${ariaLabel ?? 'Entry'} ${i + 1}`;
  const set = (at: number, next: T): void => onChange(value.map((v, j) => (j === at ? next : v)));
  const { targetIndex, draggedIds } = drag.state;

  return (
    <div className={[s.editor, className].filter(Boolean).join(' ')} role="group" aria-label={ariaLabel}>
      {value.length === 0 ? (
        <div className={s.empty}>{empty}</div>
      ) : (
        <ul className={s.list} ref={drag.containerProps.ref}>
          {value.map((entry, i) => (
            // Entries have no identity beyond their position, and two may be equal.
            <li
              key={i}
              className={s.entry}
              data-drop-before={targetIndex === i ? '' : undefined}
              data-drop-after={targetIndex === value.length && i === value.length - 1 ? '' : undefined}
              data-dragging={draggedIds?.includes(String(i)) ? '' : undefined}
              onKeyDown={(e) => move(e, i)}
            >
              {reorder && (
                <button
                  type="button"
                  ref={(el) => {
                    focus.handles.current[i] = el;
                  }}
                  className={s.handle}
                  aria-label={`Drag to reorder ${name(i)}`}
                  aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                  disabled={disabled}
                  onPointerDown={disabled ? undefined : drag.rowProps(String(i), i).onPointerDown}
                >
                  <DragGrip size={13} />
                </button>
              )}
              {renderEntry ? (
                <div className={s.control}>{renderEntry(entry, (next) => set(i, next), name(i), i)}</div>
              ) : (
                <input
                  ref={(el) => {
                    focus.inputs.current[i] = el;
                  }}
                  type="text"
                  className={`${f.frame} ${s.input}`}
                  aria-label={name(i)}
                  value={entry as string}
                  placeholder={placeholder}
                  disabled={disabled || entryDisabled?.(i) === true}
                  onChange={(e) => set(i, e.target.value as T)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                />
              )}
              <CloseButton
                ref={(el) => {
                  focus.removes.current[i] = el;
                }}
                ariaLabel={`Remove ${name(i)}`}
                disabled={disabled || value.length <= minItems}
                onClick={() => remove(i)}
              />
            </li>
          ))}
        </ul>
      )}
      <div className={s.actions}>
        <AddEntry
          kinds={kinds}
          label={addLabel}
          disabled={disabled || value.length >= maxItems}
          onAdd={(make) => insert(value.length, make)}
          buttonRef={focus.add}
        />
      </div>
    </div>
  );
}
