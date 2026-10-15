/**
 * DEV-only "what fired" panel over the dispatcher trace log the kit mounts on
 * `window.__weaselDispatchLog__`: which candidate actions each event considered,
 * which fired, and whether the event was handled. The global is not populated
 * in production builds, so the panel renders an empty table there.
 */
import { useCallback, useState, type CSSProperties, type ReactElement } from 'react';
import { useHostAnchor } from '@weasel-js/core';
import { ButtonBar, CheckIcon, DeleteIcon, Disclosure, ErrorIcon, ToggleBar } from '@weasel-js/ui';
import s from './DispatchTracePanel.module.css';
import { useDispatchTraceLog } from './dispatchTraceLog';
import { DispatchTraceTable } from './DispatchTraceTable';

type OutcomeFilter = 'handled' | 'unhandled';

export interface DispatchTracePanelProps {
  /** Initial collapsed state. Defaults to `false` (panel open). */
  defaultCollapsed?: boolean;
  /** CSS selector for the workspace element the widget pins to the bottom-left
   *  of. Default: `'.wd-canvas-host, canvas'` — the WeaselDraw workspace if
   *  present, else any canvas. */
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
  const { entries, live, now, clear: onClear } = useDispatchTraceLog(!collapsed);
  const [showHandled, setShowHandled] = useState<boolean>(true);
  // Unhandled events are noisy (every mousemove without an active gesture,
  // every wheel scroll over chrome), so they start hidden.
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
        <Disclosure
          open={!collapsed}
          onToggle={onToggleCollapse}
          label="Dispatch trace"
        />
        <span className={s.barTitle}>Dispatch trace</span>
        <span className={s.count}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
        <ToggleBar<OutcomeFilter>
          mode="multiple"
          variant="minimal"
          size="sm"
          ariaLabel="Outcome filters"
          items={[
            {
              value: 'handled',
              label: <CheckIcon size={14} className={s.handledIcon} />,
              ariaLabel: 'Handled events',
              tooltip: 'Show handled events',
            },
            {
              value: 'unhandled',
              label: <ErrorIcon size={14} className={s.unhandledIcon} />,
              ariaLabel: 'Unhandled events',
              tooltip: 'Show unhandled events',
            },
          ]}
          value={[
            ...(showHandled ? ['handled' as const] : []),
            ...(showUnhandled ? ['unhandled' as const] : []),
          ]}
          onChange={(next) => {
            setShowHandled(next.includes('handled'));
            setShowUnhandled(next.includes('unhandled'));
          }}
        />
        <ButtonBar
          variant="minimal"
          size="sm"
          ariaLabel="Trace actions"
          items={[
            {
              value: 'clear',
              label: <DeleteIcon size={14} />,
              ariaLabel: 'Clear log',
              tooltip: 'Clear log',
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
            live={live}
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

export default DispatchTracePanel;
