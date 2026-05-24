import { memo } from 'react';
import styles from './ModeBreadcrumb.module.css';

export interface ModeBreadcrumbProps {
  modeId: string;
  modeKind: 'soft' | 'strict';
  targetLabel: string | null;
  onExit: () => void;
  onCommit: () => void;
  onCancel: () => void;
}

const MODE_DISPLAY: Record<string, string> = {
  'path-edit': 'Path Edit',
  'isolation': 'Isolation',
  'text-edit': 'Text Edit',
  'free-transform': 'Free Transform',
  'crop': 'Crop',
};

export const ModeBreadcrumb = memo(function ModeBreadcrumb(props: ModeBreadcrumbProps) {
  if (props.modeId === 'normal') return null;
  const name = MODE_DISPLAY[props.modeId] ?? props.modeId;

  return (
    <div className={styles.bar} data-mode={props.modeId}>
      <span className={styles.name}>{name}</span>
      {props.targetLabel ? (
        <>
          <span className={styles.sep}>·</span>
          <span className={styles.label}>{props.targetLabel}</span>
        </>
      ) : null}
      <span className={styles.spacer} />
      {props.modeKind === 'soft' ? (
        <button type="button" className={styles.btn} onClick={props.onExit}>
          Exit
        </button>
      ) : (
        <>
          <button type="button" className={styles.btn} onClick={props.onCancel}>
            Cancel <kbd>⎋</kbd>
          </button>
          <button type="button" className={styles.btnPrimary} onClick={props.onCommit}>
            Commit <kbd>⏎</kbd>
          </button>
        </>
      )}
    </div>
  );
});
