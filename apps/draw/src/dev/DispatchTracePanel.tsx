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
import { useCallback, useState, type CSSProperties, type ReactElement } from 'react';
import { useHostAnchor } from '@weasel-js/core';
import { ButtonBar } from '@weasel-js/ui';
import s from './DispatchTracePanel.module.css';
import { useDispatchTraceLog } from './dispatchTraceLog';
import { DispatchTraceTable } from './DispatchTraceTable';

export interface DispatchTracePanelProps {
  /** Initial collapsed state. Defaults to `false` (panel open). */
  defaultCollapsed?: boolean;
  /** CSS selector for the workspace element the widget anchors to (the
   *  striped area, not the document page). The widget pins itself to this
   *  element's bottom-left in viewport coords and follows it on
   *  scroll/resize. Default: `'.wd-canvas-host, canvas'` — the
   *  WeaselDraw workspace if present, else any canvas. */
  anchorSelector?: string;
}

export function DispatchTracePanel(props: DispatchTracePanelProps = {}): ReactElement | null {
  const { defaultCollapsed = false, anchorSelector = '.wd-canvas-host, canvas' } = props;
  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);
  const { ref: anchorRef, style: anchorStyle } = useHostAnchor(
    () => document.querySelector(anchorSelector),
    { align: { x: 'start', y: 'end' }, offset: { x: 8, y: 8 } },
  );
  // Poll only while open.
  const { entries, now, clear: onClear } = useDispatchTraceLog(!collapsed);
  const [showHandled, setShowHandled] = useState<boolean>(true);
  // Unhandled events are noisy by default (every mousemove without an active
  // gesture, every wheel scroll over chrome). Hidden by default; toggle to
  // expose them when diagnosing routing problems.
  const [showUnhandled, setShowUnhandled] = useState<boolean>(false);

  const onToggleCollapse = useCallback(() => setCollapsed((c) => !c), []);

  if (!anchorStyle) return null;
  const style: CSSProperties = anchorStyle;

  return (
    <aside
      ref={anchorRef}
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
        <div className={s.filters} role="group" aria-label="Outcome filters">
          <button
            type="button"
            className={showHandled ? `${s.filterBtn} ${s.filterBtnActive}` : s.filterBtn}
            onClick={() => setShowHandled((v) => !v)}
            aria-pressed={showHandled}
            title={showHandled ? 'Hide handled events' : 'Show handled events'}
          >
            <HandledIcon />
          </button>
          <button
            type="button"
            className={showUnhandled ? `${s.filterBtn} ${s.filterBtnActive}` : s.filterBtn}
            onClick={() => setShowUnhandled((v) => !v)}
            aria-pressed={showUnhandled}
            title={showUnhandled ? 'Hide unhandled events' : 'Show unhandled events'}
          >
            <UnhandledIcon />
          </button>
        </div>
        <ButtonBar
          variant="minimal"
          ariaLabel="Trace actions"
          items={[
            {
              value: 'clear',
              label: <TrashIcon />,
              ariaLabel: 'Clear log',
              disabled: entries.length === 0,
              onAction: onClear,
            },
          ]}
        />
      </div>
      {!collapsed && (
        <div className={s.body}>
          <DispatchTraceTable
            className={s.table}
            entries={entries}
            now={now}
            showHandled={showHandled}
            showUnhandled={showUnhandled}
            empty={entries.length > 0
              ? 'All recorded events are hidden by the current filters — toggle the icons above to show them.'
              : 'No dispatch events recorded yet. Interact with the canvas to populate the log.'}
          />
        </div>
      )}
    </aside>
  );
}

/** Trash can — clears the log. */
function TrashIcon(): ReactElement {
  return (
    <svg className={s.filterIcon} viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M3 4h8M5.5 4V2.75A.75.75 0 0 1 6.25 2h1.5A.75.75 0 0 1 8.5 2.75V4M4 4l.6 7.2A1 1 0 0 0 5.6 12h2.8a1 1 0 0 0 1-.8L10 4M6 6.5v3M8 6.5v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Green check — "handled" filter. */
function HandledIcon(): ReactElement {
  return (
    <svg className={s.filterIcon} viewBox="0 0 14 14" aria-hidden="true">
      <polyline
        points="2.5,7.5 5.5,10.5 11.5,3.5"
        fill="none"
        stroke="#8fce8f"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Red bang — "unhandled" filter. Mirrors the red-tinted unhandled row style. */
function UnhandledIcon(): ReactElement {
  return (
    <svg className={s.filterIcon} viewBox="0 0 14 14" aria-hidden="true">
      <line
        x1="7" y1="2.5" x2="7" y2="8"
        stroke="#dc5040"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="7" cy="11" r="1.1" fill="#dc5040" />
    </svg>
  );
}

export default DispatchTracePanel;
