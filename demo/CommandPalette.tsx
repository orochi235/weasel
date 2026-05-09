/**
 * Command palette overlay for the weasel demo. Surfaces every Action
 * registered with the surrounding `<ActionsProvider>` so visitors can
 * discover keybindings and click-to-run them.
 *
 * Demo-only — intentionally not registered with the registry itself
 * (registering `/` as an Action would create a chicken-and-egg loop
 * since the palette is what reveals the registry's contents).
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  useActionsRegistry, evaluateEnabled, ActionDisabledReason,
  type Action, type ActionEnabledResult, type ActionDisabledReason as ActionDisabledReasonType, type KeyBinding,
} from '../src/interactions/actions/registry';

/** Display strings for the closed `ActionDisabledReason` enum. The kit
 *  ships symbolic constants; the consumer maps them to user-facing copy
 *  here so localization and theming stay in app code. */
const REASON_LABELS: Record<ActionDisabledReasonType, string> = {
  [ActionDisabledReason.SelectionRequired]: 'Selection required',
  [ActionDisabledReason.SceneEmpty]: 'Scene is empty',
  [ActionDisabledReason.NotApplicable]: 'Not applicable here',
  [ActionDisabledReason.PredicateThrew]: '(predicate threw)',
};

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

const KEY_GLYPHS: Record<string, string> = {
  Escape: 'Esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Enter: '↵',
  ' ': 'Space',
  Backspace: '⌫',
  Delete: 'Del',
  Tab: 'Tab',
};

function formatKey(key: string): string {
  if (KEY_GLYPHS[key]) return KEY_GLYPHS[key];
  return key.length === 1 ? key.toUpperCase() : key;
}

function formatBinding(binding: KeyBinding | undefined): string {
  if (!binding) return '';
  const parts: string[] = [];
  if (binding.mod) parts.push(IS_MAC ? '⌘' : 'Ctrl');
  if (binding.alt) parts.push(IS_MAC ? '⌥' : 'Alt');
  if (binding.shift === true) parts.push('⇧');
  const keys = typeof binding.key === 'string' ? [binding.key] : [...binding.key];
  parts.push(formatKey(keys[0]));
  return parts.join('+');
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const registry = useActionsRegistry();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // `list()` returns a stable readonly snapshot; re-read each time we open
  // so newly registered actions show up. We also snapshot each action's
  // `enabled` state at open time — palette is short-lived; live reactive
  // updates as selection changes are explicitly out of scope. See Action.enabled JSDoc.
  const allActions = useMemo<readonly Action[]>(
    () => (registry && open ? registry.list() : []),
    [registry, open],
  );

  const enabledById = useMemo<ReadonlyMap<string, ActionEnabledResult>>(() => {
    const m = new Map<string, ActionEnabledResult>();
    for (const a of allActions) m.set(a.id, evaluateEnabled(a));
    return m;
  }, [allActions]);

  const filtered = useMemo<readonly Action[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allActions;
    return allActions.filter((a) => a.label.toLowerCase().includes(q));
  }, [allActions, query]);

  const isEnabled = (a: Action): boolean => enabledById.get(a.id)?.enabled ?? true;
  const reasonFor = (a: Action): string | undefined => {
    const r = enabledById.get(a.id)?.reason;
    return r ? REASON_LABELS[r] : undefined;
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
    // No enabled rows — leave highlight where it was.
  };

  // Reset state on open and focus the input.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlight(0);
    // Defer focus until after the input is mounted.
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

  // Escape handler at the document level so it works even if focus has
  // escaped the overlay (e.g. backdrop click moved focus).
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

  const trigger = (action: Action) => {
    if (!isEnabled(action)) return;
    onClose();
    // Defer trigger to next tick so `onClose` state flush completes before
    // any action that may itself touch focus / DOM.
    queueMicrotask(() => {
      registry?.trigger(action.id);
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
      const action = filtered[highlight];
      if (action && isEnabled(action)) trigger(action);
    }
  };

  return (
    <div className="ckd-palette-backdrop" onMouseDown={onClose}>
      <div
        className="ckd-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="ckd-palette-input"
          type="text"
          placeholder="Search actions…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
          onKeyDown={onInputKeyDown}
          spellCheck={false}
          autoComplete="off"
        />
        {!registry ? (
          <div className="ckd-palette-empty">No actions available.</div>
        ) : filtered.length === 0 ? (
          <div className="ckd-palette-empty">No matching actions.</div>
        ) : (
          <ul ref={listRef} className="ckd-palette-list" role="listbox">
            {filtered.map((action, idx) => {
              const enabled = isEnabled(action);
              const reason = reasonFor(action);
              return (
                <li
                  key={action.id}
                  data-idx={idx}
                  role="option"
                  aria-selected={idx === highlight}
                  aria-disabled={!enabled}
                  className={`ckd-palette-row${idx === highlight ? ' active' : ''}${enabled ? '' : ' disabled'}`}
                  onMouseEnter={() => { if (enabled) setHighlight(idx); }}
                  onMouseDown={(e) => { e.preventDefault(); if (enabled) trigger(action); }}
                  title={reason}
                >
                  <span className="ckd-palette-label">{action.label}</span>
                  {!enabled && reason && (
                    <span className="ckd-palette-reason">{reason}</span>
                  )}
                  {action.defaultBinding && (
                    <kbd className="ckd-palette-kbd">{formatBinding(action.defaultBinding)}</kbd>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="ckd-palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Wires the `/` key to open the palette. Uses a direct document listener
 * (NOT the actions registry) to avoid the bootstrap loop noted in the
 * file header.
 */
export function useCommandPaletteShortcut(open: boolean, setOpen: (v: boolean) => void) {
  useEffect(() => {
    if (open) return; // already open — let the palette's own handlers take over
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
