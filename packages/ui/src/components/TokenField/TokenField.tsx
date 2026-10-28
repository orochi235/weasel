import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useReorderDragList, type ReorderItem } from '../../useReorderDragList';
import { movedEntry } from '../ListEditor/listEntries';
import { wrapLine } from '../../wrapLine';
import { Badge } from '../Badge';
import f from '../field.module.css';
import { TokenEditor, TokenText } from './TokenEditor';
import { useTokenFocus } from './tokenFocus';
import s from './TokenField.module.css';

/** Props for {@link TokenField}. */
export interface TokenFieldProps<T = string> {
  value: readonly T[];
  /** Every add, edit, removal and move, with the whole list. */
  onChange: (next: T[]) => void;
  /** A token's text on its chip. Without it the tokens are strings, shown as they are. */
  label?: (token: T) => string;
  /** Shown while the pointer rests on a token or it has focus. */
  tooltip?: (token: T) => ReactNode;
  /** The token typed text makes, or `undefined` to refuse the text. Without it the tokens are strings, kept as typed. */
  create?: (text: string) => T | undefined;
  /** Draws the controls in a token's popover. Without it the popover holds a text field of the token's label,
   *  and the text it commits remakes the token through `create`. */
  renderEditor?: (token: T, set: (next: T) => void, index: number) => ReactNode;
  /** What is wrong with the token at `index`, if anything: its chip reads as invalid and its tooltip says why. */
  problem?: (tokens: readonly T[], index: number) => string | undefined;
  /** Tokens can be moved: dragged, or Alt+Left / Alt+Right on a focused one. */
  reorder?: boolean;
  /** Tokens cannot be removed at this many. */
  minItems?: number;
  /** Tokens cannot be added at this many. */
  maxItems?: number;
  /** Shown in the text field while there are no tokens. */
  placeholder?: string;
  /** Takes no input: nothing is typed, edited, moved or removed. */
  disabled?: boolean;
  /** Whether the token at `index` opens no editor. It can still be moved and removed. */
  locked?: (index: number) => boolean;
  /** Names the field for assistive tech; each token is named by its label. */
  'aria-label'?: string;
  className?: string;
}

/** {@link TokenFieldProps} for tokens that are not strings, which have to be labeled and made. */
export type ItemTokenFieldProps<T> = TokenFieldProps<T> & Required<Pick<TokenFieldProps<T>, 'label' | 'create'>>;

/** Text that ends a token as it is typed. */
const SEPARATORS = new Set(['Enter', ',']);

/**
 * A list edited as a row of chips that wraps, with a text field after them. Typing and pressing Enter or a comma
 * adds a token, and so does leaving the field with text in it. A click on a chip, or Enter on a focused one, opens
 * a popover that edits it; its × removes it.
 *
 * From the keyboard, Left and Right move between the chips and the field, Backspace or Delete removes a focused
 * chip, and Backspace in the empty field moves to the last chip. With `reorder`, chips are dragged into place or
 * moved with Alt+Left / Alt+Right.
 */
export function TokenField(props: TokenFieldProps): ReactNode;
export function TokenField<T>(props: ItemTokenFieldProps<T>): ReactNode;
export function TokenField<T>({
  value,
  onChange,
  label = String,
  tooltip,
  create = (text) => text as T,
  renderEditor,
  problem,
  reorder = false,
  minItems = 0,
  maxItems = Infinity,
  placeholder,
  disabled = false,
  locked,
  'aria-label': ariaLabel,
  className,
}: TokenFieldProps<T>) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const focus = useTokenFocus();
  const container = useRef<HTMLDivElement | null>(null);
  const movable = reorder && !disabled;
  const removable = !disabled && value.length > minItems;
  const full = value.length >= maxItems;
  const edit = (at: number): void => { if (!disabled && locked?.(at) !== true) setEditing(at); };

  const items = useMemo((): ReorderItem[] => value.map((_, i) => ({ id: String(i), label: '' })), [value]);
  const line = useMemo(() => wrapLine(() => [...(container.current?.querySelectorAll(':scope > [data-token]') ?? [])]), []);
  const drag = useReorderDragList({
    items,
    selectedIds: [],
    line,
    rowSelector: '[data-token]',
    onReorder: ([id], target) => {
      const from = Number(id);
      onChange(movedEntry(value, from, target));
      focus.request(target > from ? target - 1 : target);
    },
    onPress: (id) => edit(Number(id)),
  });

  const commit = (): void => {
    const text = draft.trim();
    if (text === '' || full) return;
    const token = create(text);
    if (token === undefined) return;
    onChange([...value, token]);
    setDraft('');
  };
  const remove = (at: number): void => {
    if (!removable) return;
    onChange(value.filter((_, i) => i !== at));
    focus.request(value.length === 1 ? 'input' : Math.max(0, at - 1));
  };
  const set = (at: number, next: T): void => onChange(value.map((v, i) => (i === at ? next : v)));

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    const caretAtStart = e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0;
    if (SEPARATORS.has(e.key) && draft.trim() !== '') {
      e.preventDefault();
      commit();
    } else if (value.length > 0 && caretAtStart && (e.key === 'Backspace' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      focus.request(value.length - 1);
    }
  };
  const onChipKey = (e: KeyboardEvent<HTMLElement>, at: number): void => {
    if (e.target !== e.currentTarget || disabled) return;
    const by = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (by !== 0 && e.altKey) {
      e.preventDefault();
      if (movable && drag.nudge(String(at), at, by)) focus.request(at + by);
    } else if (by !== 0) {
      e.preventDefault();
      focus.request(at + by >= value.length ? 'input' : Math.max(0, at + by));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      remove(at);
    }
  };

  const open = editing !== null && editing < value.length ? editing : null;
  return (
    <div
      ref={(el) => {
        container.current = el;
        drag.containerProps.ref(el);
      }}
      className={[f.frame, s.field, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={ariaLabel}
      data-disabled={disabled ? '' : undefined}
      onClick={(e) => { if (e.target === e.currentTarget) focus.request('input'); }}
    >
      {value.map((token, i) => {
        const text = label(token);
        const name = text === '' ? 'Empty' : text;
        const wrong = problem?.(value, i);
        const tip = tooltip?.(token);
        return (
          // Tokens have no identity beyond their position, and two may be equal.
          <span
            key={i}
            data-token=""
            className={s.slot}
            data-drop-before={drag.state.targetIndex === i ? '' : undefined}
            data-drop-after={drag.state.targetIndex === value.length && i === value.length - 1 ? '' : undefined}
            data-dragging={drag.state.draggedIds?.includes(String(i)) ? '' : undefined}
          >
            <Badge
              ref={(el) => { focus.chips.current[i] = el; }}
              className={s.token}
              variant="subtle"
              grade={wrong === undefined ? undefined : 'danger'}
              aria-label={wrong === undefined ? name : `${name}, ${wrong}`}
              tooltip={wrong === undefined ? tip : <>{tip}{tip != null && <br />}{wrong}</>}
              onClick={disabled ? undefined : () => edit(i)}
              onRemove={removable ? () => remove(i) : undefined}
              removeLabel={`Remove ${name}`}
              labelProps={{
                onKeyDown: (e) => onChipKey(e, i),
                ...(movable && { onPointerDown: drag.rowProps(String(i), i).onPointerDown }),
              }}
            >
              {text === '' ? ' ' : text}
            </Badge>
          </span>
        );
      })}
      <input
        ref={focus.input}
        type="text"
        className={s.input}
        aria-label={ariaLabel ? `Add to ${ariaLabel}` : 'Add'}
        value={draft}
        placeholder={value.length === 0 ? placeholder : undefined}
        disabled={disabled || full}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onInputKey}
        onBlur={commit}
      />
      {open !== null && (
        <TokenEditor
          anchor={focus.chips.current[open] ?? null}
          title={`Edit ${label(value[open]!) || 'empty token'}`}
          onClose={() => {
            setEditing(null);
            focus.request(open);
          }}
        >
          {renderEditor
            ? renderEditor(value[open]!, (next) => set(open, next), open)
            : <TokenText value={label(value[open]!)} onCommit={(text) => {
                const next = create(text);
                if (next !== undefined) set(open, next);
              }} />}
        </TokenEditor>
      )}
    </div>
  );
}
