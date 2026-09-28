import { useId, type ReactNode } from 'react';
import type {
  DispatchRecord,
  DispatchRecordInput,
  DroppedCandidate,
  PlacedBy,
  RankedCandidate,
  RecordCandidate,
  WalkStep,
} from '@weasel-js/core/routing';
import { Badge } from '../Badge';
import { Code } from '../Code';
import { GestureRoute } from '../GestureRoute';
import { KeyCap, KeySequence, keySpecFromKey, keySpecsFromMods, type LogicalModSpec } from '../Keycaps';
import s from './FallthroughDiagram.module.css';

function placedByLabel(p: PlacedBy): string {
  return p.step === 'specificity' ? `specificity · ${p.part}` : p.step;
}

function walkLabel(w: WalkStep): ReactNode {
  switch (w.kind) {
    case 'fired': return 'fired';
    case 'would-fire': return 'would fire';
    case 'declined': return <>declined: {w.reason}</>;
    case 'empty-handle': return 'empty handle';
    case 'misbound': return 'misbound';
    case 'duplicate': return 'duplicate';
    case 'no-such-action': return 'no such action';
    case 'not-asked': return 'not asked';
    case 'outranked': return 'outranked';
  }
}

const isWinner = (w: WalkStep) => w.kind === 'fired' || w.kind === 'would-fire';

const MOD_ORDER = ['shift', 'alt', 'ctrl', 'meta'] as const;

function InputLine({ input, predicted }: { input: DispatchRecordInput; predicted: boolean }) {
  const mods: LogicalModSpec[] = MOD_ORDER.filter((m) => input.modifiers[m]).map((name) => ({ name }));
  return (
    <dl className={s.input} aria-label="Input">
      <div className={s.field}>
        <dt>Event</dt>
        <dd>{input.eventKind}</dd>
      </div>
      {input.key !== undefined && (
        <div className={s.field}>
          <dt>Key</dt>
          <dd data-key={input.key}>
            <KeyCap label={keySpecFromKey(input.key, { legend: 'text' }).label} variant="minimal" />
          </dd>
        </div>
      )}
      <div className={s.field}>
        <dt>Modifiers</dt>
        <dd>{mods.length > 0 ? <KeySequence keys={keySpecsFromMods(mods)} variant="minimal" /> : 'none'}</dd>
      </div>
      {input.viewId !== null && (
        <div className={s.field}>
          <dt>View</dt>
          <dd>{input.viewId}</dd>
        </div>
      )}
      {input.mode !== undefined && (
        <div className={s.field}>
          <dt>Mode</dt>
          <dd>{input.mode}</dd>
        </div>
      )}
      {predicted && (
        <div className={s.field}>
          <dd><Badge size="xs" status="accent" variant="subtle">predicted</Badge></dd>
        </div>
      )}
    </dl>
  );
}

function Routes({ candidate }: { candidate: RecordCandidate }) {
  return (
    <span className={s.routes}>
      {candidate.routes.map((r) => <GestureRoute key={r} route={r} size="sm" />)}
    </span>
  );
}

function Stage({ title, note, filter, children }: {
  title: string;
  note?: ReactNode;
  filter?: DroppedCandidate['filter'];
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <section className={s.stage} aria-labelledby={id} data-filter={filter}>
      <h3 className={s.stageTitle}>
        <span id={id}>{title}</span>
        {note && <span className={s.note}>{note}</span>}
      </h3>
      {children}
    </section>
  );
}

function MatchedStage({ matched }: { matched: readonly RecordCandidate[] }) {
  return (
    <Stage title="Matched" note="every binding that fits the input">
      <table className={s.table}>
        <thead>
          <tr><th>Action</th><th>Route</th><th>Tool</th><th>Tier</th></tr>
        </thead>
        <tbody>
          {matched.map((c, i) => (
            <tr key={i}>
              <td><Code size="sm">{c.actionId}</Code></td>
              <td><Routes candidate={c} /></td>
              <td className={c.ownerToolId === null ? s.muted : undefined}>{c.ownerToolId ?? 'action'}</td>
              <td>{c.scope}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Stage>
  );
}

function dropReason(d: DroppedCandidate): ReactNode {
  if (d.filter === 'ineligible') return <><Code size="sm" variant="plain">{d.rule}</Code> does not hold</>;
  return d.owner !== undefined
    ? <>barred by the exclusive claim of <Code size="sm" variant="plain">{d.owner}</Code></>
    : 'barred by an exclusive claim';
}

function FilterBand({ title, filter, dropped }: {
  title: string;
  filter: DroppedCandidate['filter'];
  dropped: readonly DroppedCandidate[];
}) {
  const mine = dropped.filter((d) => d.filter === filter);
  if (mine.length === 0) return <Stage title={title} filter={filter} note="dropped nothing" />;
  return (
    <Stage title={title} filter={filter} note="dropped">
      <table className={s.table}>
        <thead>
          <tr><th>Action</th><th>Route</th><th>Why</th></tr>
        </thead>
        <tbody>
          {mine.map((d, i) => (
            <tr key={i}>
              <td><Code size="sm">{d.candidate.actionId}</Code></td>
              <td><Routes candidate={d.candidate} /></td>
              <td>{dropReason(d)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Stage>
  );
}

function RankedStage({ ranked }: { ranked: readonly RankedCandidate[] }) {
  if (ranked.length === 0) return <Stage title="Ranked" note="nothing survived the filters" />;
  return (
    <Stage title="Ranked" note="highest first, with what the walk did at each">
      <table className={s.table}>
        <thead>
          <tr>
            <th className={s.num}>#</th><th>Action</th><th>Placed by</th><th>Walk</th>
            <th>Tier</th><th>Specificity</th><th>Rule</th><th>Route</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r, i) => {
            const c = r.candidate;
            const winner = isWinner(r.walk);
            return (
              <tr
                key={i}
                className={winner ? s.winner : undefined}
                data-walk={r.walk.kind}
                data-winner={winner || undefined}
                aria-current={winner || undefined}
              >
                <td className={s.num}>{i + 1}</td>
                <td><Code size="sm">{c.actionId}</Code></td>
                <td>
                  <Badge size="xs" variant="outline" status={r.placedBy.step === 'first' ? 'muted' : 'warn'}>
                    {placedByLabel(r.placedBy)}
                  </Badge>
                </td>
                <td className={s.walk} data-walk={r.walk.kind}>{walkLabel(r.walk)}</td>
                <td>{c.scope}</td>
                <td className={s.num} aria-label="target, modifiers, phase, exact">{c.specificity.join(' ')}</td>
                <td>{c.eligible ? <Code size="sm" variant="plain">{c.eligible}</Code> : <span className={s.muted}>none</span>}</td>
                <td><Routes candidate={c} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Stage>
  );
}

/** Props for {@link FallthroughDiagram}. */
export interface FallthroughDiagramProps {
  record: DispatchRecord;
  className?: string;
}

/**
 * One dispatch drawn top to bottom: the input, every binding it matched, what
 * the claim and eligibility filters dropped, and the ranked survivors with the
 * step that placed each one and what the walk did with it. The winner's row
 * carries `data-winner`.
 */
export function FallthroughDiagram({ record, className }: FallthroughDiagramProps) {
  const cls = className ? `${s.diagram} ${className}` : s.diagram;
  return (
    <div className={cls} data-outcome={record.outcome} data-predicted={record.predicted || undefined}>
      <InputLine input={record.input} predicted={record.predicted} />
      {record.matched.length === 0 ? (
        <p className={s.nothing}>Nothing matched this input.</p>
      ) : (
        <>
          <MatchedStage matched={record.matched} />
          <FilterBand title="Claim" filter="claim" dropped={record.dropped} />
          <FilterBand title="Eligibility" filter="ineligible" dropped={record.dropped} />
          <RankedStage ranked={record.ranked} />
        </>
      )}
    </div>
  );
}
