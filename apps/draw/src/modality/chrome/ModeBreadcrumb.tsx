import { memo } from 'react';
import { modeLabel, type ModeDefinition } from '@weasel-js/modes';
import { Button } from '@weasel-js/ui/components/Button';
import { KeyCap } from '@weasel-js/ui/components/Keycaps';
import styles from './ModeBreadcrumb.module.css';

export interface ModeBreadcrumbProps {
  mode: ModeDefinition;
  targetLabel: string | null;
  /** The entered group, which the bar names ahead of any mode open inside it. */
  group?: { label: string; onExit: () => void } | null;
  onExit: () => void;
  onCommit: () => void;
  onCancel: () => void;
}

export const ModeBreadcrumb = memo(function ModeBreadcrumb(props: ModeBreadcrumbProps) {
  const { group } = props;
  const inMode = props.mode.id !== 'normal';
  if (!inMode && !group) return null;

  return (
    <div className={styles.bar} data-mode={inMode ? props.mode.id : 'group'}>
      {group ? (
        <>
          <span className={styles.name}>Group</span>
          <span className={styles.sep}>·</span>
          <span className={styles.label}>{group.label}</span>
          {inMode ? <span className={styles.sep}>›</span> : null}
        </>
      ) : null}
      {inMode ? <span className={styles.name}>{modeLabel(props.mode)}</span> : null}
      {inMode && props.targetLabel ? (
        <>
          <span className={styles.sep}>·</span>
          <span className={styles.label}>{props.targetLabel}</span>
        </>
      ) : null}
      <span className={styles.spacer} />
      {!inMode ? (
        <Button size="sm" onClick={group?.onExit}>Exit</Button>
      ) : props.mode.kind === 'soft' ? (
        <Button size="sm" onClick={props.onExit}>Exit</Button>
      ) : (
        <>
          <Button size="sm" onClick={props.onCancel} trailingIcon={<KeyCap label="⎋" />}>
            Cancel
          </Button>
          <Button size="sm" stance="confirm" onClick={props.onCommit} trailingIcon={<KeyCap label="⏎" />}>
            Commit
          </Button>
        </>
      )}
    </div>
  );
});
