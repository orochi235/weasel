/**
 * DispatchTracePanel — DEV-only "what fired" diagnostic panel.
 *
 * Reads the rolling dispatcher trace log mounted by the kit on
 * `window.__weaselDispatchLog__` (populated by
 * `src/interactions/dispatcher/dispatcher.ts` in DEV builds only). The log
 * holds the last 200 input-handling decisions: which candidate actions
 * were considered for each event, whether each was enabled, which one
 * actually fired, and whether the event was ultimately handled.
 *
 * Use this panel to diagnose "X doesn't fire" complaints without having
 * to redispatch an agent — the log is right there, click an unhandled row
 * to see why every candidate was rejected.
 *
 * IMPORTANT: This component is DEV-only. The window global is not
 * populated in production builds, so the panel renders an empty table.
 * Wire it into the app sidebar (e.g. behind a `#/dev/dispatch` route or a
 * "Show dev panels" pref) only in development.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import s from './DispatchTracePanel.module.css';

// Structural copy of `DispatchLogEntry` from
// `src/interactions/dispatcher/dispatcher.ts`. Kept local so this panel
// doesn't pull a non-public symbol across the package boundary; if the
// kit ever re-exports the type, swap this for the import.
interface DispatchLogEntry {
  ts: number;
  eventKind: string;
  candidates: Array<{
    actionId: string;
    scope: 'hotkey' | 'active' | 'ambient';
    enabledResult: boolean | string;
  }>;
  fired: string | null;
  outcome: 'handled' | 'unhandled';
}

interface DispatchLogWindow extends Window {
  __weaselDispatchLog__?: DispatchLogEntry[];
}

const POLL_MS = 250;
const DISPLAY_LIMIT = 100;

function readLog(): DispatchLogEntry[] {
  if (typeof window === 'undefined') return [];
  const w = window as DispatchLogWindow;
  return w.__weaselDispatchLog__ ?? [];
}

function clearLog(): void {
  if (typeof window === 'undefined') return;
  const w = window as DispatchLogWindow;
  const log = w.__weaselDispatchLog__;
  // Mutate in place so the dispatcher's own reference keeps appending
  // into the same array (replacing the global would orphan the writer).
  if (log) log.length = 0;
}

export interface DispatchTracePanelProps {
  /** Initial collapsed state. Defaults to `false` (panel open). */
  defaultCollapsed?: boolean;
  /** CSS selector for the workspace element the widget anchors to (the
   *  striped area, not the document page). The widget pins itself to this
   *  element's bottom-left in viewport coords and follows it on
   *  scroll/resize. Default: `'.swill-canvas-host, canvas'` — the
   *  swillustrator workspace if present, else any canvas. */
  anchorSelector?: string;
}

interface Anchor { left: number; bottom: number; }

function readAnchor(el: Element | null): Anchor | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, bottom: window.innerHeight - r.bottom };
}

export function DispatchTracePanel(props: DispatchTracePanelProps = {}): ReactElement | null {
  const { defaultCollapsed = false, anchorSelector = '.swill-canvas-host, canvas' } = props;
  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  // Track the workspace element's bottom-left in viewport coords. Mirrors
  // CursorCoordsHud's anchor-tracking so the widget sits inside the canvas
  // even when the page scrolls or the layout reflows.
  useEffect(() => {
    let raf = 0;
    const reread = () => {
      const el = document.querySelector(anchorSelector);
      setAnchor(readAnchor(el));
    };
    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => { raf = 0; reread(); });
    };
    reread();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (ro) ro.observe(document.body);
    return () => {
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (raf) window.cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [anchorSelector]);
  const [entries, setEntries] = useState<DispatchLogEntry[]>(() => readLog().slice());
  const [expanded, setExpanded] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const lastLenRef = useRef<number>(entries.length);
  const lastTsRef = useRef<number>(entries.length ? entries[entries.length - 1]!.ts : 0);

  // Poll the log only while the panel is uncollapsed. We snapshot length
  // + last-ts and skip the React setState when nothing changed, so the
  // 250 ms tick is cheap when the app is idle. `now` still updates each
  // tick so the "Age" column ticks upward without log activity.
  useEffect(() => {
    if (collapsed) return;
    const id = window.setInterval(() => {
      const log = readLog();
      const len = log.length;
      const lastTs = len ? log[len - 1]!.ts : 0;
      if (len !== lastLenRef.current || lastTs !== lastTsRef.current) {
        lastLenRef.current = len;
        lastTsRef.current = lastTs;
        setEntries(log.slice());
      }
      setNow(Date.now());
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [collapsed]);

  const onClear = useCallback(() => {
    clearLog();
    setEntries([]);
    setExpanded(null);
    lastLenRef.current = 0;
    lastTsRef.current = 0;
  }, []);

  const visible = entries.slice(-DISPLAY_LIMIT).reverse();
  const onToggleCollapse = useCallback(() => setCollapsed((c) => !c), []);

  if (!anchor) return null;
  const INSET = 8;
  const style: CSSProperties = {
    left: anchor.left + INSET,
    bottom: anchor.bottom + INSET,
  };

  return (
    <aside
      className={`${s.widget} ${collapsed ? s.widgetCollapsed : ''}`}
      style={style}
    >
      <div className={s.bar}>
        <button
          type="button"
          className={s.toggle}
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand dispatch trace' : 'Collapse dispatch trace'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <span className={s.chevron} aria-hidden="true">{collapsed ? '▴' : '▾'}</span>
          <span className={s.barTitle}>Dispatch trace</span>
        </button>
        <span className={s.count}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
        <button
          type="button"
          className={s.clear}
          onClick={onClear}
          disabled={entries.length === 0}
        >
          Clear
        </button>
      </div>
      {!collapsed && (
        <div className={s.body}>
        {visible.length === 0 ? (
          <p className={s.empty}>
            No dispatch events recorded yet. Interact with the canvas to populate the log.
          </p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Age</th>
                <th>Event</th>
                <th>Outcome</th>
                <th>Cands</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry, idx) => {
                const rowKey = `${entry.ts}-${idx}`;
                const isExpanded = expanded === entry.ts;
                const ageMs = Math.max(0, now - entry.ts);
                const unhandled = entry.outcome === 'unhandled';
                const rowClass = [
                  s.row,
                  unhandled ? s.rowUnhandled : '',
                  isExpanded ? s.rowExpanded : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <RowGroup
                    key={rowKey}
                    entry={entry}
                    ageMs={ageMs}
                    isExpanded={isExpanded}
                    rowClass={rowClass}
                    onToggle={() => setExpanded(isExpanded ? null : entry.ts)}
                  />
                );
              })}
            </tbody>
          </table>
        )}
        </div>
      )}
    </aside>
  );
}

function RowGroup(props: {
  entry: DispatchLogEntry;
  ageMs: number;
  isExpanded: boolean;
  rowClass: string;
  onToggle: () => void;
}): ReactElement {
  const { entry, ageMs, isExpanded, rowClass, onToggle } = props;
  return (
    <>
      <tr className={rowClass} onClick={onToggle}>
        <td>{formatAge(ageMs)}</td>
        <td>{entry.eventKind}</td>
        <td>{renderOutcome(entry)}</td>
        <td>{entry.candidates.length}</td>
      </tr>
      {isExpanded && (
        <tr className={s.detailRow}>
          <td colSpan={4}>
            {entry.candidates.length === 0 ? (
              <em>No candidates considered.</em>
            ) : (
              <table className={s.candTable}>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Scope</th>
                    <th>Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.candidates.map((c, i) => (
                    <tr
                      key={`${c.actionId}-${i}`}
                      className={c.actionId === entry.fired ? s.candFired : undefined}
                    >
                      <td>{c.actionId}</td>
                      <td>{c.scope}</td>
                      <td>{formatEnabled(c.enabledResult)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function renderOutcome(entry: DispatchLogEntry): ReactElement | string {
  if (entry.outcome === 'unhandled') return 'unhandled';
  return entry.fired ? <code>{entry.fired}</code> : 'handled';
}

function formatAge(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  return `${m}m${Math.floor(sec % 60)}s`;
}

function formatEnabled(v: boolean | string): string {
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return v;
}

export default DispatchTracePanel;
