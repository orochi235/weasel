import { memo } from 'react';
import { modeLabel, type ModeDefinition } from '@weasel-js/modes';
import { Button, KeyCap } from '@weasel-js/ui';
import styles from './ModeBreadcrumb.module.css';

export interface ModeBreadcrumbProps {
  mode: ModeDefinition;
  targetLabel: string | null;
  onExit: () => void;
  onCommit: () => void;
  onCancel: () => void;
}

export const ModeBreadcrumb = memo(function ModeBreadcrumb(props: ModeBreadcrumbProps) {
  if (props.mode.id === 'normal') return null;

  return (
    <div className={styles.bar} data-mode={props.mode.id}>
      <span className={styles.name}>{modeLabel(props.mode)}</span>
      {props.targetLabel ? (
        <>
          <span className={styles.sep}>·</span>
          <span className={styles.label}>{props.targetLabel}</span>
        </>
      ) : null}
      <span className={styles.spacer} />
      {props.mode.kind === 'soft' ? (
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
