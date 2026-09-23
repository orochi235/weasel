import { memo } from 'react';
import { Button, KeyCap } from '@weasel-js/ui';
import { modeDisplayName } from './modeDisplay';
import styles from './ModeBreadcrumb.module.css';

export interface ModeBreadcrumbProps {
  modeId: string;
  modeKind: 'soft' | 'strict';
  targetLabel: string | null;
  onExit: () => void;
  onCommit: () => void;
  onCancel: () => void;
}

export const ModeBreadcrumb = memo(function ModeBreadcrumb(props: ModeBreadcrumbProps) {
  if (props.modeId === 'normal') return null;

  return (
    <div className={styles.bar} data-mode={props.modeId}>
      <span className={styles.name}>{modeDisplayName(props.modeId)}</span>
      {props.targetLabel ? (
        <>
          <span className={styles.sep}>·</span>
          <span className={styles.label}>{props.targetLabel}</span>
        </>
      ) : null}
      <span className={styles.spacer} />
      {props.modeKind === 'soft' ? (
        <Button size="sm" onClick={props.onExit}>Exit</Button>
      ) : (
        <>
          <Button size="sm" onClick={props.onCancel} trailingIcon={<KeyCap label="⎋" variant="minimal" />}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={props.onCommit} trailingIcon={<KeyCap label="⏎" variant="minimal" />}>
            Commit
          </Button>
        </>
      )}
    </div>
  );
});
