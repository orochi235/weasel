import { useMemo, type KeyboardEvent, type ReactNode } from 'react';
import { imeKey } from '@weasel-js/headless';
import type { ReorderDragState } from '../../useReorderDragList';
import { CloseButton } from '../CloseButton';
import { ReorderHandle } from '../ReorderHandle/ReorderHandle';
import f from '../field.module.css';
import { AddEntry, type ListEntryKind } from './AddEntry';
import { useEntryDraft } from './entryDraft';
import { useEntryMoves, useListFocus } from './listEntries';
import s from './ListEditor.module.css';

export type { ListEntryKind };

/** Props for {@link ListEditor}. */
export interface ListEditorProps<T = string> {
  value: readonly T[];
  /** Every edit, add, removal and move, with the whole list. A text entry is written like any typed field: on
   *  blur or Enter, or once typing rests where it settles when idle. An empty one stays until it is removed. */
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
  /** A text entry commits once typing rests, as well as on blur or Enter. Defaults to the
   *  `typing.settleWhenIdle` kit setting. */
  settleWhenIdle?: boolean;
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

// The overloads leave `newEntry` out only for a list of strings.
function kindsOf<T>(newEntry: ListEditorProps<T>['newEntry'], label: string): readonly ListEntryKind<T>[] {
  if (typeof newEntry === 'function') return [{ label, make: newEntry }];
  return newEntry ?? [{ label, make: () => '' as T }];
}

/** Marks the entry being dragged, and the edge of the one a drop would land against. */
function dropAttrs(i: number, count: number, { targetIndex, draggedIds }: ReorderDragState) {
  return {
    'data-drop-before': targetIndex === i ? '' : undefined,
    'data-drop-after': targetIndex === count && i === count - 1 ? '' : undefined,
    'data-dragging': draggedIds?.includes(String(i)) ? '' : undefined,
  };
}

/**
 * An editable list: one control per entry, a remove button beside each, and
 * an add button under them. Entries are strings in text fields unless
 * `renderEntry` draws them. A text field holds what is typed until blur,
 * Enter or a rest, like any typed field; Enter adds an entry after it and
 * Backspace in an empty one removes it. With `reorder`, entries move by
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
  settleWhenIdle,
}: ListEditorProps<T>) {
  const focus = useListFocus();
  const kinds = useMemo(() => kindsOf(newEntry, addLabel), [newEntry, addLabel]);
  const entries = useEntryDraft(value, onChange, settleWhenIdle);
  const list = entries.typed;

  const insert = (at: number, make: () => T): void => {
    if (list.length >= maxItems) return;
    entries.write([...list.slice(0, at), make(), ...list.slice(at)]);
    focus.request({ at, to: 'input' });
  };
  const remove = (at: number): void => {
    if (list.length <= minItems) return;
    entries.write(list.filter((_, i) => i !== at));
    focus.request({ at: Math.max(0, at - 1), to: 'removed' });
  };
  const { drag, move } = useEntryMoves(list, entries.write, focus, reorder && !disabled);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, at: number): void => {
    if (imeKey(e.nativeEvent)) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (kinds[0]) insert(at + 1, kinds[0].make);
    } else if (e.key === 'Backspace' && entries.shown(at) === '') {
      e.preventDefault();
      remove(at);
    } else entries.keyDown(e);
  };
  const name = (i: number): string => `${ariaLabel ?? 'Entry'} ${i + 1}`;
  const set = (at: number, next: T): void => entries.write(list.map((v, j) => (j === at ? next : v)));

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
              {...dropAttrs(i, value.length, drag.state)}
              onKeyDown={(e) => move(e, i)}
            >
              {reorder && (
                <ReorderHandle
                  className={s.handle}
                  label={name(i)}
                  disabled={disabled}
                  ref={(el) => {
                    focus.handles.current[i] = el;
                  }}
                  onPointerDown={drag.rowProps(String(i), i).onPointerDown}
                />
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
                  value={entries.shown(i)}
                  placeholder={placeholder}
                  disabled={disabled || entryDisabled?.(i) === true}
                  onFocus={() => entries.focus(i)}
                  onChange={(e) => entries.type(i, e.target.value)}
                  onBlur={entries.settle}
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
