import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  actionItemTitle,
  actionShortcuts,
  useSelectionContext,
  type ActionItem,
} from '@weasel-js/core';
import { Dialog } from '../Dialog';
import { ActionSettingsDialog } from '../ActionSettings/ActionSettingsDialog';
import { DEFAULT_REASON_LABELS } from '../ActionBar/reasonLabels';
import { formatShortcutParts } from '@weasel-js/gestures';
import { KeySequence, keySpecFromKey } from '../Keycaps';
import { describeSelection } from './selectionSummary';
import { usePaletteItems, type PaletteItems } from './usePaletteItems';
import styles from './CommandPalette.module.css';

/** Every shortcut an entry answers to, as chip groups. An entry can be
 *  bound more than once — Bring to Front has two — so each binding gets its
 *  own group rather than one being picked as canonical. */
function ShortcutChips({ item }: { item: ActionItem }) {
  const shortcuts = actionShortcuts(item.action, item.params);
  if (shortcuts.length === 0) return null;
  return (
    <span className={styles.shortcuts}>
      {shortcuts.map((s) => {
        const parts = formatShortcutParts(s);
        return (
          <KeySequence
            key={`${s.leader?.map((l) => l.label).join('|')}|${s.key}|${s.mod}|${s.alt}|${s.shift}`}
            keys={parts?.keys}
            leader={parts?.leader}
            joins="none"
          />
        );
      })}
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
  open: boolean;
  onClose: () => void;
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
      {items.filtered.map((item, idx) => {
        const { enabled, reason: code } = items.enabledOf(item);
        const reason = code ? reasonLabels[code] : undefined;
        const tag = items.tagOf(item);
        const cls = [
          styles.row,
          idx === highlight ? styles.rowActive : '',
          enabled ? '' : styles.rowDisabled,
        ].filter(Boolean).join(' ');
        return (
          <li
            key={item.key}
            id={`${id}-${idx}`}
            data-idx={idx}
            role="option"
            aria-selected={idx === highlight}
            aria-disabled={!enabled}
            className={cls}
            onMouseEnter={() => { if (enabled) onHighlight(idx); }}
            onMouseDown={(e) => { e.preventDefault(); if (enabled) onRun(item); }}
            title={reason}
          >
            <span className={styles.label}>{actionItemTitle(item)}</span>
            {tag !== undefined && <span className={styles.tag}>{tag}</span>}
            {!enabled && reason && (
              <span className={styles.reason}>{reason}</span>
            )}
            <ShortcutChips item={item} />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A dialog that lists every action registered with the surrounding
 * `<ActionsProvider>`, filters by label or tag, and runs the chosen one. The host
 * owns `open`. The list and each row's `enabled` state are read when it
 * opens and not again while it is open. A row found by a tag and not its
 * label names that tag beside the label. An entry whose action carries
 * settings opens their form in a dialog rather than running bare. With a `<SelectionContextProvider>`
 * in scope the footer says how much is selected.
 */
export function CommandPalette({ open, onClose, reasonLabels }: CommandPaletteProps) {
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

  /** Move the highlight to the next/prev *enabled* row. */
  const moveHighlight = (delta: 1 | -1): void => {
    if (filtered.length === 0) return;
    let i = highlight;
    for (let step = 0; step < filtered.length; step++) {
      i = (i + delta + filtered.length) % filtered.length;
      if (items.enabledOf(filtered[i]).enabled) {
        setPicked(i);
        return;
      }
    }
  };

  const run = (item: ActionItem) => {
    if (!items.enabledOf(item).enabled) return;
    onClose();
    if (item.action.settings) {
      setSettingsOf(item);
      return;
    }
    queueMicrotask(() => {
      registry?.trigger(item.action.id, item.params);
    });
  };

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
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
        onOpenChange={(next) => { if (!next) onClose(); }}
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
