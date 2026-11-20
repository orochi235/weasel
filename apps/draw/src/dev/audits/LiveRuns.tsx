import { LANE_STEPS, headlineOf, lastLineOf, sharedLaneOf, spendOf, stepText } from './runData';
import type { AuditRun } from './skulkMap.types';
import s from './LiveRuns.module.css';

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/** One run's strip: what it is doing and what it has spent, its last line, and a lane per area. */
function RunStrip({ run, now, onPick }: { run: AuditRun; now: number; onPick: (id: string) => void }) {
  const shared = sharedLaneOf(run);
  return (
    <section className={cx(s.run, !run.running && s.idle)} aria-label={`Round ${run.round}`}>
      <div className={s.pulse} aria-hidden="true" />
      <div className={s.what}>{headlineOf(run)}</div>
      <div className={s.spend}>{spendOf(run)}</div>
      <div className={s.line}>{lastLineOf(run)}</div>
      {run.lanes.length > 0 && (
        <div className={s.lanes}>
          <div className={s.grid} role="table" aria-label={`Round ${run.round} lanes`}>
            <div role="row" className={s.row}>
              <span role="columnheader" className={s.head}>area</span>
              {LANE_STEPS.map(({ step, label }) => <span key={step} role="columnheader" className={s.head}>{label}</span>)}
            </div>
            {run.lanes.map((lane) => (
              <div key={lane.id} role="row" className={s.row}>
                <span role="rowheader" className={s.nameCell}>
                  <button type="button" className={s.name} onClick={() => onPick(lane.id)}>{lane.id}</button>
                </span>
                {LANE_STEPS.map(({ step }) => {
                  const st = lane.steps[step];
                  const text = stepText(step, st, now);
                  return (
                    <span key={step} role="cell" title={`${lane.id} · ${step}: ${text}`}
                      className={cx(s.seg, s[st.state], st.state === 'done' && (step === 'fix' || step === 'patch') && s.fixed)}>
                      {text}
                    </span>
                  );
                })}
              </div>
            ))}
            <div role="row" className={s.row}>
              <span role="rowheader" className={s.nameCell}>all areas</span>
              <span role="cell" className={cx(s.seg, s.shared, s[shared.state])}>{shared.text}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** A strip for every live run, then for the run that finished last. */
export function LiveRuns({ runs, now, onPick }: { runs: readonly AuditRun[]; now: number; onPick: (id: string) => void }) {
  if (runs.length === 0) return <section className={cx(s.run, s.idle)}><div className={s.what}>No round on record.</div></section>;
  return (
    <div className={s.runs} aria-live="polite">
      {runs.map((run) => <RunStrip key={run.round} run={run} now={now} onPick={onPick} />)}
    </div>
  );
}
