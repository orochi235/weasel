import { InlineMarkdown } from '@weasel-js/ui/components/InlineMarkdown';
import { useLayoutEffect, useRef } from 'react';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { SpanStrips, type SpanStripSpan, type SpanStripsRow } from '@weasel-js/ui/components/SpanStrip';
import { clockRuler } from './clock';
import { STEP_COLUMN_COUNT, laneStepsOf, laneViewOf, passDone, runClockOf, type LaneView } from './phases';
import { NODE_SEP, headlineOf, lastLineOf, sharedLaneOf, spendOf, startedText } from './runData';
import { useViewerPref } from './viewerPref';
import type { AuditLane, AuditRun } from './skulkMap.types';
import s from './LiveRuns.module.css';

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/** What naming an area does: a click picks it on the map, and hovering or focusing lights it there. */
export interface AreaHandlers {
  readonly onPick: (id: string) => void;
  readonly onLight: (id: string | null) => void;
}

/** A running span with its node's name marked, so the name alone pulses. */
function withNode(span: SpanStripSpan): SpanStripSpan {
  const at = span.state === 'active' ? span.label.indexOf(NODE_SEP) : -1;
  if (at <= 0) return span;
  return { ...span, content: <><span className={s.node}>{span.label.slice(0, at)}</span>{span.label.slice(at)}</> };
}

/** An area's lane as a stack row: its name, and `spans`, its steps in the view chosen. */
function laneRow(lane: AuditLane, view: LaneView, on: AreaHandlers, spans: SpanStripSpan[]): SpanStripsRow {
  return {
    id: lane.id,
    spans: spans.map(withNode),
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
const MODES = [{ value: 'clock', label: 'Clock' }, { value: 'steps', label: 'Steps' }] as const;

/** The viewer's lane view, kept between visits: on the run's clock (the default), or as a grid of steps. */
function useLaneMode(): [LaneMode, (mode: LaneMode) => void] {
  const [mode, setMode, keep] = useViewerPref<LaneMode>('lanes', 'clock', (s) => (s === 'steps' ? 'steps' : undefined));
  return [mode, (next) => { setMode(next); keep(next); }];
}

/** Whether the viewer hides finished lanes, kept between visits. */
function useHideComplete(): [boolean, (hide: boolean) => void] {
  const [hide, setHide, keep] = useViewerPref('hideComplete', false, (s) => s === 'true');
  return [hide, (next) => { setHide(next); keep(next); }];
}

const STEPS_WINDOW = { from: 0, to: STEP_COLUMN_COUNT };

/** The run's areas, on the run's clock or as a grid of steps; a finished one stays, filled, until the run ends, unless
 *  the viewer hides those whose pass is done, as the map shows them. */
function Lanes({ run, now, mode, hideComplete, on }: { run: AuditRun; now: number; mode: LaneMode; hideComplete: boolean; on: AreaHandlers }) {
  const ref = useRef<HTMLDivElement>(null);
  const clock = runClockOf(run, now);
  const lanes = run.lanes.map((lane) => ({ lane, view: laneViewOf(lane, now, clock.from) })).filter(({ lane }) => !hideComplete || !passDone(lane));
  const widest = Math.max(0, ...run.lanes.map((l) => l.id.length));
  useLayoutEffect(() => { ref.current?.style.setProperty('--audit-lead-ch', String(widest)); }, [widest]);
  // A label's element is remade whenever its text changes, restarting its pulse; one shared start keeps every pulse in step.
  useLayoutEffect(() => {
    for (const a of ref.current?.getAnimations?.({ subtree: true }) ?? []) {
      if (a instanceof CSSAnimation && a.animationName.includes('node-pulse')) a.startTime = 0;
    }
  });
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
function RunStrip({ run, now, mode, onMode, hideComplete, onHideComplete, on }: {
  run: AuditRun; now: number; mode: LaneMode; onMode: (mode: LaneMode) => void;
  hideComplete: boolean; onHideComplete: (hide: boolean) => void; on: AreaHandlers;
}) {
  const shared = sharedLaneOf(run);
  return (
    <section className={s.run} aria-label={`Round ${run.round}`}>
      <div className={s.pulse} aria-hidden="true" />
      <div className={s.what}>
        <span>{headlineOf(run)}</span>
        {run.started && <span className={s.started}>{startedText(run.started, now)}</span>}
      </div>
      <div className={s.line} title={lastLineOf(run)}><InlineMarkdown text={lastLineOf(run)} /></div>
      <div className={s.view}>
        <Checkbox isSelected={hideComplete} onChange={onHideComplete}>Hide complete</Checkbox>
        <SegmentedBar aria-label="Lane view" size="sm" items={MODES} value={mode} onChange={(v) => v && onMode(v)} />
      </div>
      <div className={s.spend}>{spendOf(run)}</div>
      {run.lanes.length > 0 && (
        <div className={s.lanes} data-mode={mode}>
          <Lanes run={run} now={now} mode={mode} hideComplete={hideComplete} on={on} />
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
  const [hideComplete, setHideComplete] = useHideComplete();
  const live = runs.filter((r) => r.running);
  if (live.length === 0) return <section className={cx(s.run, s.idle)}><div className={s.what}>No round running</div></section>;
  return (
    <div className={s.runs} aria-live="polite">
      {live.map((run) => <RunStrip key={run.round} run={run} now={now} mode={mode} onMode={setMode} hideComplete={hideComplete} onHideComplete={setHideComplete} on={on} />)}
    </div>
  );
}
