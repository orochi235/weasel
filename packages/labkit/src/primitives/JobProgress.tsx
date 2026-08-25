import { ErrorIcon, WarningIcon } from '@weasel-js/ui';
import type { JobHandle } from '../job/types';

/** Props for `<JobProgress>`. */
export interface JobProgressProps {
  job: JobHandle;
  className?: string;
}

/** A running job's progress, failures and outcome. Determinate once the job
 *  reports a total; a job that cannot count up front never sends one, so the
 *  bar stays indeterminate rather than inventing a denominator. */
export function JobProgress({ job, className }: JobProgressProps) {
  const { status, done, total, failures, error } = job;
  if (status === 'idle') return null;

  const determinate = total !== null && total > 0;
  const fraction = determinate ? Math.min(1, done / total) : 0;
  const cls = ['lk-job', `lk-job--${status}`, className].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <div
        className={`lk-job__track${determinate ? '' : ' lk-job__track--indeterminate'}`}
        role="progressbar"
        aria-label="Job progress"
        aria-valuenow={determinate ? done : undefined}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? total : undefined}
      >
        {/* Scaling a full-width bar keeps the fill off the layout path, so
            progress updates never reflow the status bar. */}
        <div
          className="lk-job__fill"
          style={{ transform: `scaleX(${determinate ? fraction : 1})` }}
        />
      </div>

      <span className="lk-job__count">
        {done}
        {determinate ? ` / ${total}` : ''}
      </span>

      {failures.length > 0 && (
        <span className="lk-job__failures" title={failures.map((f) => f.error).join('\n')}>
          <WarningIcon size={14} />
          {failures.length} failed
        </span>
      )}

      {error && (
        <span className="lk-job__error" title={error}>
          <ErrorIcon size={14} />
          {error}
        </span>
      )}

      {status === 'running' && (
        <button type="button" className="lk-job__cancel" onClick={job.cancel}>
          Cancel
        </button>
      )}
    </div>
  );
}
