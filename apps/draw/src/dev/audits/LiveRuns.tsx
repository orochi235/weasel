import { useLayoutEffect, useRef, useState } from 'react';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { SpanStrips, type SpanStripSpan, type SpanStripsRow } from '@weasel-js/ui/components/SpanStrip';
import { clockRuler } from './clock';
import { laneStepsOf, laneViewOf, runClockOf, type LaneView } from './phases';
import { headlineOf, lastLineOf, sharedLaneOf, spendOf } from './runData';
import type { AuditLane, AuditRun } from './skulkMap.types';
import s from './LiveRuns.module.css';

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/** What naming an area does: a click picks it on the map, and hovering or focusing lights it there. */
export interface AreaHandlers {
  readonly onPick: (id: string) => void;
  readonly onLight: (id: string | null) => void;
}

/** An area's lane as a stack row: its name, and `spans`, its steps in the view chosen. */
function laneRow(lane: AuditLane, view: LaneView, on: AreaHandlers, spans: SpanStripSpan[]): SpanStripsRow {
  return {
    id: lane.id,
    spans,
    'aria-label': lane.id,
    valueText: view.elapsed ? `${view.phase}, ${view.elapsed} in` : view.phase,
    lead: (
      <button
        type="button" className={s.name} onClick={() => on.onPick(lane.id)}
        onPointerEnter={() => on.onLight(lane.id)} onPointerLeave={() => on.onLight(null)} onFocus={() => on.onLight(lane.id)} onBlur={() => on.onLight(null)}
      >
        {lane.id}
      </button>
    ),
  };
}

export type LaneMode = 'clock' | 'steps';
const MODE_KEY = 'weasel.audits.lanes';
const MODES = [{ value: 'clock', label: 'Clock' }, { value: 'steps', label: 'Steps' }] as const;

/** The viewer's lane view, kept between visits: on the run's clock (the default), or as a grid of steps. */
function useLaneMode(): [LaneMode, (mode: LaneMode) => void] {
  const [mode, setMode] = useState<LaneMode>(() => {
    try {
      return localStorage.getItem(MODE_KEY) === 'steps' ? 'steps' : 'clock';
    } catch {
      return 'clock';
    }
  });
  const choose = (next: LaneMode) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // Nowhere to keep it; the choice lasts the visit.
    }
  };
  return [mode, choose];
}

const STEPS_WINDOW = { from: 0, to: 5 };

/** Every area of the run, on the run's clock or as a grid of steps; a finished one stays, filled, until the run ends. */
function Lanes({ run, now, mode, on }: { run: AuditRun; now: number; mode: LaneMode; on: AreaHandlers }) {
  const ref = useRef<HTMLDivElement>(null);
  const clock = runClockOf(run, now);
  const lanes = run.lanes.map((lane) => ({ lane, view: laneViewOf(lane, now, clock.from) }));
  const widest = Math.max(0, ...run.lanes.map((l) => l.id.length));
  useLayoutEffect(() => { ref.current?.style.setProperty('--audit-lead-ch', String(widest)); }, [widest]);
  if (lanes.length === 0) return null;
  const rows = lanes.map(({ lane, view }) => laneRow(lane, view, on, mode === 'steps' ? laneStepsOf(lane, now) : view.spans));
  return (
    <div ref={ref}>
      {mode === 'clock'
        ? <SpanStrips aria-label={`Round ${run.round} lanes`} window={clock} at={now} ruler={clockRuler(clock.from)} rows={rows} />
        : <SpanStrips aria-label={`Round ${run.round} lanes`} window={STEPS_WINDOW} rows={rows} />}
    </div>
  );
}

/** One run's strip: what it is doing and what it has spent, its last line, and a lane per area in flight. */
function RunStrip({ run, now, mode, onMode, on }: {
  run: AuditRun; now: number; mode: LaneMode; onMode: (mode: LaneMode) => void; on: AreaHandlers;
}) {
  const shared = sharedLaneOf(run);
  return (
    <section className={s.run} aria-label={`Round ${run.round}`}>
      <div className={s.pulse} aria-hidden="true" />
      <div className={s.what}>{headlineOf(run)}</div>
      <div className={s.line} title={lastLineOf(run)}>{lastLineOf(run)}</div>
      <SegmentedBar aria-label="Lane view" size="sm" items={MODES} value={mode} onChange={(v) => v && onMode(v)} />
      <div className={s.spend}>{spendOf(run)}</div>
      {run.lanes.length > 0 && (
        <div className={s.lanes}>
          <Lanes run={run} now={now} mode={mode} on={on} />
          <div className={s.sharedRow}>
            <span className={s.nameCell}>all areas</span>
            <span className={cx(s.shared, s[shared.state])}>{shared.text}</span>
          </div>
        </div>
      )}
    </section>
  );
}

/** A strip for every run still running; a finished round lives on in the rounds chart and the map. */
export function LiveRuns({ runs, now, on }: { runs: readonly AuditRun[]; now: number; on: AreaHandlers }) {
  const [mode, setMode] = useLaneMode();
  const live = runs.filter((r) => r.running);
  if (live.length === 0) return <section className={cx(s.run, s.idle)}><div className={s.what}>No round running</div></section>;
  return (
    <div className={s.runs} aria-live="polite">
      {live.map((run) => <RunStrip key={run.round} run={run} now={now} mode={mode} onMode={setMode} on={on} />)}
    </div>
  );
}
