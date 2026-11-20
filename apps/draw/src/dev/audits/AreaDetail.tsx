import type { ReactNode } from 'react';
import { Badge } from '@weasel-js/ui/components/Badge';
import { DetailList, DetailRow } from '@weasel-js/ui/components/DetailList';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import type { Grade } from '@weasel-js/theme';
import { STATUS_LABEL, lastPassOf, stageLabelOf } from './areaData';
import type { AreaStatus, AuditArea, AuditRun } from './skulkMap.types';
import s from './AreaDetail.module.css';

const GRADE: Readonly<Record<AreaStatus, Grade | undefined>> = { unaudited: undefined, due: 'info', settled: 'success', tonight: 'danger' };

function Passes({ area }: { area: AuditArea }) {
  if (area.passes.length === 0) return <p className={s.hint}>No round has read it yet.</p>;
  return (
    <table className={s.table}>
      <thead>
        <tr><th>round</th><th className={s.vennCell}><Venn a="A" both={<abbr title="found by both">∩</abbr>} b="B" /></th><th>found</th><th>est.</th><th>left</th></tr>
      </thead>
      <tbody>
        {area.passes.map((p) => (
          <tr key={p.round}>
            <td>{p.round}</td><td className={s.vennCell}><Venn a={p.a - p.shared} both={p.shared} b={p.b - p.shared} /></td><td>{p.distinct}</td>
            <td>{p.est.toFixed(1)}</td><td>{p.left.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Reviewer A's findings and B's as two pills overlapping in the middle: only A's, the ones both found, only B's. */
function Venn({ a, both, b }: { a: ReactNode; both: ReactNode; b: ReactNode }) {
  return (
    <div className={s.venn}>
      <span className={s.pillA} aria-hidden="true" />
      <span className={s.pillB} aria-hidden="true" />
      <span>{a}</span><span className={s.both}>{both}</span><span>{b}</span>
    </div>
  );
}

/** The area under the pointer, or else the one picked: its status, its counts, and every pass over it. */
export function AreaDetail({ area, holder }: { area: AuditArea | undefined; holder: AuditRun | undefined }) {
  const last = area && lastPassOf(area);
  return (
    <SidebarPanel title="Area">
      {!area ? <p className={s.hint}>Hover or click an area for its passes.</p> : (
        <div className={s.body}>
          <div className={s.id}>{area.id}</div>
          <div><Badge shape="pill" size="sm" variant="solid" {...(GRADE[area.status] ? { grade: GRADE[area.status] } : {})}>
            {holder ? `in round ${holder.round}` : STATUS_LABEL[area.status]}
          </Badge></div>
          <DetailList values="figures">
            <DetailRow label="source files">{area.files}</DetailRow>
            <DetailRow label="passes">{area.passes.length}</DetailRow>
            {area.queue !== null && <DetailRow label="queue position">{area.queue}</DetailRow>}
            {area.stage && <DetailRow label="this run" values="text">{stageLabelOf(area.stage)}</DetailRow>}
            {last && <DetailRow label={`left after round ${last.round}`}>{last.left.toFixed(1)}</DetailRow>}
          </DetailList>
          <Passes area={area} />
        </div>
      )}
    </SidebarPanel>
  );
}
