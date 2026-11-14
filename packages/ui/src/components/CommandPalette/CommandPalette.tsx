import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { imeKey, stepStop } from '@weasel-js/ui-input';
import {
  actionItemShortcuts,
  actionItemTitle,
  useSelectionContext,
  type ActionItem,
} from '@weasel-js/core';
import { Dialog } from '../Dialog';
import { useAppearance } from '../appearance';
import { ActionSettingsDialog } from '../ActionSettings/ActionSettingsDialog';
import { DEFAULT_REASON_LABELS, reasonLabel } from '../ActionBar/reasonLabels';
import { KeySequence, ShortcutKeys } from '../Keycaps';
import { keySpecFromKey } from '@weasel-js/gestures';
import { describeSelection } from './selectionSummary';
import { usePaletteItems, type PaletteItems } from './usePaletteItems';
import styles from './CommandPalette.module.css';

/** The entry's own `shortcut` text when it has one, else every shortcut it answers to, as chip groups. An entry can be
 *  bound more than once — Bring to Front has two — so each binding gets its
 *  own group rather than one being picked as canonical. */
function ShortcutChips({ item }: { item: ActionItem }) {
  const shortcuts = actionItemShortcuts(item);
  if (typeof shortcuts === 'string') return <span className={styles.shortcuts}>{shortcuts}</span>;
  if (shortcuts.length === 0) return null;
  return (
    <span className={styles.shortcuts}>
      {shortcuts.map((s) => (
        <ShortcutKeys key={`${s.leader?.map((l) => l.label).join('|')}|${s.key}|${s.mod}|${s.alt}|${s.shift}`} shortcut={s} />
      ))}
    </span>
  );
}

const HINTS = [
  { keys: [keySpecFromKey('ArrowUp'), keySpecFromKey('ArrowDown')], label: 'navigate' },
  { keys: [keySpecFromKey('Enter')], label: 'run' },
  { keys: [keySpecFromKey('Escape')], label: 'close' },
];

/** How much is selected, when known, and the keys the palette answers to. */
function PaletteFooter({ selection }: { selection: string | null }) {
  return (
    <>
      {selection && <span className={styles.selection}>{selection}</span>}
      {HINTS.map((h) => (
        <span className={styles.hint} key={h.label}>
          <KeySequence keys={h.keys} joins="none" variant="inverse" />
          {h.label}
        </span>
      ))}
    </>
  );
}

/** Props for {@link CommandPalette}. */
export interface CommandPaletteProps {
  isOpen: boolean;
  /** The palette asks to close, after running an entry or on Escape, as `Dialog`'s does. */
  onOpenChange: (isOpen: boolean) => void;
  /** Override the default symbolic-reason → display-string map. */
  reasonLabels?: Record<string, string>;
}

interface PaletteListProps {
  id: string;
  items: PaletteItems;
  highlight: number;
  reasonLabels: Record<string, string>;
  onHighlight(idx: number): void;
  onRun(item: ActionItem): void;
}

function PaletteList({ id, items, highlight, reasonLabels, onHighlight, onRun }: PaletteListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLLIElement>(`li[data-idx="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  return (
    <ul ref={listRef} id={id} className={styles.list} role="listbox" aria-label="Actions">
      {items.filtered.map((item, idx) => (
        <PaletteRow
          key={item.key}
          id={`${id}-${idx}`}
          idx={idx}
          item={item}
          items={items}
          highlighted={idx === highlight}
          reasonLabels={reasonLabels}
          onHighlight={onHighlight}
          onRun={onRun}
        />
      ))}
    </ul>
  );
}

interface PaletteRowProps extends Pick<PaletteListProps, 'items' | 'reasonLabels' | 'onHighlight' | 'onRun'> {
  id: string;
  idx: number;
  item: ActionItem;
  highlighted: boolean;
}

/** One entry: its title, the tag that found it, why it cannot run or else what it does, and its shortcut. */
function PaletteRow({ id, idx, item, items, highlighted, reasonLabels, onHighlight, onRun }: PaletteRowProps) {
  const { enabled, reason: code } = items.enabledOf(item);
  const reason = code ? reasonLabel(code, reasonLabels) : undefined;
  const hint = reason ?? item.description;
  const tag = items.tagOf(item);
  const appearance = useAppearance({ grade: item.grade });
  const cls = [
    styles.row,
    highlighted ? styles.rowActive : '',
    enabled ? '' : styles.rowDisabled,
  ].filter(Boolean).join(' ');
  return (
    <li
      id={id}
      data-idx={idx}
      role="option"
      aria-selected={highlighted}
      aria-disabled={!enabled}
      aria-description={hint}
      {...appearance}
      className={cls}
      onMouseEnter={() => { if (enabled) onHighlight(idx); }}
      onMouseDown={(e) => { e.preventDefault(); if (enabled && e.button === 0) onRun(item); }}
      title={hint}
    >
      <span className={styles.label}>{actionItemTitle(item)}</span>
      {tag !== undefined && <span className={styles.tag}>{tag}</span>}
      {!enabled && reason && (
        <span className={styles.reason}>{reason}</span>
      )}
      <ShortcutChips item={item} />
    </li>
  );
}

/**
 * A dialog that lists every action registered with the surrounding
 * `<ActionsProvider>`, filters by label or tag, and runs the chosen one. The host
 * owns `isOpen`. The list and each row's `enabled` state are read when it
 * opens and not again while it is open. A row found by a tag and not its
 * label names that tag beside the label. An entry whose action carries
 * settings opens their form in a dialog rather than running bare. With a `<SelectionContextProvider>`
 * in scope the footer says how much is selected.
 */
export function CommandPalette({ isOpen: open, onOpenChange, reasonLabels }: CommandPaletteProps) {
  const selectionCtx = useSelectionContext();
  const [query, setQuery] = useState('');
  // `null` until a key or the pointer picks a row: the first enabled one.
  const [picked, setPicked] = useState<number | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery('');
      setPicked(null);
    }
  }
  // An entry carrying settings, whose form opens once the palette has closed.
  const [settingsOf, setSettingsOf] = useState<ActionItem | null>(null);
  const items = usePaletteItems(open, query);
  const { registry, filtered } = items;

  // Dropped when a registry change shrinks the list under it.
  if (picked !== null && picked >= filtered.length) setPicked(null);
  const highlight = picked ?? Math.max(0, filtered.findIndex((i) => items.enabledOf(i).enabled));

  const moveHighlight = (dir: 1 | -1): void => {
    const next = stepStop(filtered, highlight, dir, { canStop: (i) => items.enabledOf(i).enabled });
    if (next !== null) setPicked(next);
  };

  const run = (item: ActionItem) => {
    if (!items.enabledOf(item).enabled) return;
    onOpenChange(false);
    if (item.action.settings) {
      setSettingsOf(item);
      return;
    }
    queueMicrotask(() => {
      registry?.trigger(item.action.id, item.params);
    });
  };

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (imeKey(e.nativeEvent)) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[highlight];
      if (item) run(item);
    }
  };

  const headerText = describeSelection(selectionCtx);
  const listId = useId();

  return (
    <>
      <ActionSettingsDialog item={settingsOf} onClose={() => setSettingsOf(null)} />
      <Dialog
        isOpen={open}
        onOpenChange={onOpenChange}
        isDismissable
        title="Commands"
        showCloseButton={false}
        className={styles.palette}
        bodyClassName={styles.body}
        footer={<PaletteFooter selection={headerText} />}
      >
        <input
          className={styles.input}
          type="text"
          placeholder="Search actions…"
          aria-label="Search actions"
          role="combobox"
          aria-expanded={filtered.length > 0}
          aria-controls={listId}
          aria-activedescendant={filtered.length > 0 ? `${listId}-${highlight}` : undefined}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPicked(null); }}
          onKeyDown={onInputKeyDown}
          spellCheck={false}
          autoComplete="off"
          autoFocus
        />
        {!registry ? (
          <div className={styles.empty}>No actions available.</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No matching actions.</div>
        ) : (
          <PaletteList
            id={listId}
            items={items}
            highlight={highlight}
            reasonLabels={reasonLabels ?? DEFAULT_REASON_LABELS}
            onHighlight={setPicked}
            onRun={run}
          />
        )}
      </Dialog>
    </>
  );
}
