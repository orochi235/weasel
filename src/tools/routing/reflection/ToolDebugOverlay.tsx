// src/tools/routing/reflection/ToolDebugOverlay.tsx
import type { ReactElement } from 'react';
import type { RouteResolvedInfo } from './route-resolved';
import styles from './ToolDebugOverlay.module.css';

export interface ToolDebugOverlayProps {
  /** Most recent route resolution. Pass the result of useToolDebugInfo(). */
  info: RouteResolvedInfo | null;
  /** Optional override for the "idle" placeholder text shown when info is null. */
  emptyLabel?: string;
}

/** Dev-tools-style panel showing the most recently resolved route.
 *  Mount in a corner of the viewport (typically bottom-right). Pure
 *  presentation — no dispatcher coupling; the parent threads the info. */
export function ToolDebugOverlay({
  info,
  emptyLabel = 'No route resolved yet',
}: ToolDebugOverlayProps): ReactElement {
  if (!info) {
    return (
      <div className={styles.overlay} data-state="empty">
        <span className={styles.empty}>{emptyLabel}</span>
      </div>
    );
  }
  const modText = info.modifiers === 'default' ? '—' : info.modifiers;
  const gestureText = info.arg !== undefined ? `${info.gesture}(${info.arg})` : info.gesture;
  const targetText = info.target.category === 'empty'
    ? 'empty'
    : `${info.target.kind}${'id' in info.target ? `(${String(info.target.id)})` : ''}`;
  return (
    <div className={styles.overlay} data-state="resolved">
      <div className={styles.row}>
        <span className={styles.label}>tool</span>
        <span className={styles.value}>{info.toolId}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>phase</span>
        <span className={styles.value}>{info.phase}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>gesture</span>
        <span className={styles.value}>{gestureText}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>matched</span>
        <span className={styles.value}>{info.matchedKey}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>target</span>
        <span className={styles.value}>{targetText}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>mods</span>
        <span className={styles.value}>{modText}</span>
      </div>
    </div>
  );
}
