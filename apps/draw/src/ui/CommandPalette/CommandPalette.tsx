/**
 * @experimental
 * Command palette overlay. Reads every Action registered with the
 * surrounding `<ActionsProvider>` and exposes a search-and-run UI.
 *
 * Reads the ambient selection (when an `<SelectionContextProvider>` is in
 * scope) so the palette can show a "N selected" header — purely informational;
 * action-availability is driven by each Action's own `enabled` predicate.
 *
 * Snapshot semantics: the action list and each row's `enabled` state are
 * captured when the palette opens; live reactive updates while open are out
 * of scope. See `Action.enabled` JSDoc in the kit.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  useActionsRegistry,
  useOptionalDepRegistry,
  actionItems,
  actionShortcuts,
  buildDepsFromRequires,
  evaluateEnabled,
  ActionDisabledReason,
  useSelectionContext,
  type ActionItem,
  type ActionEnabledResult,
} from '@weasel-js/core';
import { formatShortcutParts } from '@weasel-js/ui';
import styles from './CommandPalette.module.css';

/** Display strings for the closed `ActionDisabledReason` enum. Defined here
 *  (not in the kit) so localization and theming stay in app code; consumers
 *  can override by passing `reasonLabels`. */
const DEFAULT_REASON_LABELS: Record<string, string> = {
  [ActionDisabledReason.SelectionRequired]: 'Selection required',
  [ActionDisabledReason.SceneEmpty]: 'Scene is empty',
  [ActionDisabledReason.NotApplicable]: 'Not applicable here',
  [ActionDisabledReason.PredicateThrew]: '(predicate threw)',
};

/** Every shortcut an entry answers to, as chip groups. An entry can be
 *  bound more than once — Bring to Front has two — so each binding gets its
 *  own group rather than one being picked as canonical. */
function ShortcutChips({ item }: { item: ActionItem }) {
  const groups = actionShortcuts(item.action, item.params)
    .map((s) => formatShortcutParts(s))
    .filter((parts): parts is readonly string[] => parts !== undefined);
  if (groups.length === 0) return null;
  return (
    <span className={styles.shortcuts}>
      {groups.map((parts) => (
        <span className={styles.shortcutGroup} key={parts.join('')}>
          {parts.map((part) => <kbd className={styles.kbd} key={part}>{part}</kbd>)}
        </span>
      ))}
    </span>
  );
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** Override the default symbolic-reason → display-string map. */
  reasonLabels?: Record<string, string>;
}

export function CommandPalette({ open, onClose, reasonLabels }: CommandPaletteProps) {
  const registry = useActionsRegistry();
  const depReg = useOptionalDepRegistry();
  const selectionCtx = useSelectionContext();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const labels = reasonLabels ?? DEFAULT_REASON_LABELS;

  const allItems = useMemo<readonly ActionItem[]>(
    () => (registry && open ? registry.list().flatMap(actionItems) : []),
    [registry, open],
  );

  const enabledById = useMemo<ReadonlyMap<string, ActionEnabledResult>>(() => {
    const m = new Map<string, ActionEnabledResult>();
    for (const { action } of allItems) {
      if (m.has(action.id)) continue;
      const deps = depReg ? buildDepsFromRequires(action, depReg) : undefined;
      m.set(action.id, evaluateEnabled(action, deps));
    }
    return m;
  }, [allItems, depReg]);

  const filtered = useMemo<readonly ActionItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((i) => i.label.toLowerCase().includes(q));
  }, [allItems, query]);

  const isEnabled = (i: ActionItem): boolean => enabledById.get(i.action.id)?.enabled ?? true;
  const reasonFor = (i: ActionItem): string | undefined => {
    const r = enabledById.get(i.action.id)?.reason;
    return r ? labels[r] : undefined;
  };

  /** Move the highlight to the next/prev *enabled* row. */
  const moveHighlight = (delta: 1 | -1): void => {
    if (filtered.length === 0) return;
    let i = highlight;
    for (let step = 0; step < filtered.length; step++) {
      i = (i + delta + filtered.length) % filtered.length;
      if (isEnabled(filtered[i])) {
        setHighlight(i);
        return;
      }
    }
  };

  // Reset state on open and focus the input.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlight(0);
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  // Clamp highlight when filter shrinks the list.
  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(Math.max(0, filtered.length - 1));
  }, [filtered.length, highlight]);

  // Scroll highlighted row into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLLIElement>(
      `li[data-idx="${highlight}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  // Document-level Escape so it works even if focus left the overlay.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const trigger = (item: ActionItem) => {
    if (!isEnabled(item)) return;
    onClose();
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
      if (item && isEnabled(item)) trigger(item);
    }
  };

  const headerText = describeSelection(selectionCtx);

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        className={styles.palette}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {headerText && <div className={styles.header}>{headerText}</div>}
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          placeholder="Search actions…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
          onKeyDown={onInputKeyDown}
          spellCheck={false}
          autoComplete="off"
        />
        {!registry ? (
          <div className={styles.empty}>No actions available.</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No matching actions.</div>
        ) : (
          <ul ref={listRef} className={styles.list} role="listbox">
            {filtered.map((item, idx) => {
              const enabled = isEnabled(item);
              const reason = reasonFor(item);
              const cls = [
                styles.row,
                idx === highlight ? styles.rowActive : '',
                enabled ? '' : styles.rowDisabled,
              ].filter(Boolean).join(' ');
              return (
                <li
                  key={item.key}
                  data-idx={idx}
                  role="option"
                  aria-selected={idx === highlight}
                  aria-disabled={!enabled}
                  className={cls}
                  onMouseEnter={() => { if (enabled) setHighlight(idx); }}
                  onMouseDown={(e) => { e.preventDefault(); if (enabled) trigger(item); }}
                  title={reason}
                >
                  <span className={styles.label}>{item.label}</span>
                  {!enabled && reason && (
                    <span className={styles.reason}>{reason}</span>
                  )}
                  <ShortcutChips item={item} />
                </li>
              );
            })}
          </ul>
        )}
        <div className={styles.footer}>
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

/** Pluralize an English noun for the palette header. Naïve — handles the
 *  common (-s, -es) cases; consumers wanting an exact form should rename
 *  their kind labels (`'paths'`) or fork this. */
function pluralize(noun: string, count: number): string {
  if (count === 1) return noun;
  if (/(s|x|z|ch|sh)$/.test(noun)) return `${noun}es`;
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

/** Build the palette's selection header from the ambient context. Returns
 *  `null` when no provider is in scope. */
function describeSelection(
  ctx: { readonly selection: readonly string[]; readonly kinds?: readonly (string | undefined)[] } | null,
): string | null {
  if (ctx == null) return null;
  const n = ctx.selection.length;
  if (n === 0) return 'No selection';
  const kinds = ctx.kinds;
  // All entries reported the same non-undefined kind?
  if (kinds && kinds.length === n) {
    const first = kinds[0];
    if (typeof first === 'string' && kinds.every((k) => k === first)) {
      return `${n} ${pluralize(first, n)} selected`;
    }
  }
  return n === 1 ? '1 object selected' : `${n} objects selected`;
}

/**
 * @experimental
 * Wires the `/` key to open the palette. Uses a direct document listener
 * (not the actions registry) to avoid the bootstrap loop where registering
 * the opener as an Action would require the palette to already be open
 * to discover it.
 */
export function useCommandPaletteShortcut(open: boolean, setOpen: (v: boolean) => void) {
  useEffect(() => {
    if (open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target;
      if (target instanceof Element) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if ((target as HTMLElement).isContentEditable) return;
      }
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);
}
