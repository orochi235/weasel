import { Badge } from '@weasel-js/ui/components/Badge';
import { DetailList, DetailRow } from '@weasel-js/ui/components/DetailList';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import type { Grade } from '@weasel-js/theme';
import { getOwn } from '@weasel-js/registry';
import { STAGE_LABEL, STATUS_LABEL, lastPassOf } from './areaData';
import type { AreaStatus, AuditArea, AuditRun } from './skulkMap.types';
import s from './AreaDetail.module.css';

const GRADE: Readonly<Record<AreaStatus, Grade | undefined>> = { unaudited: undefined, due: 'info', settled: 'success', tonight: 'danger' };

function Passes({ area }: { area: AuditArea }) {
  if (area.passes.length === 0) return <p className={s.hint}>No round has read it yet.</p>;
  return (
    <table className={s.table}>
      <thead>
        <tr><th>round</th><th>A</th><th>B</th><th>both</th><th>found</th><th>est.</th><th>left</th></tr>
      </thead>
      <tbody>
        {area.passes.map((p) => (
          <tr key={p.round}>
            <td>{p.round}</td><td>{p.a}</td><td>{p.b}</td><td>{p.shared}</td><td>{p.distinct}</td>
            <td>{p.est.toFixed(1)}</td><td>{p.left.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
            {area.stage && <DetailRow label="this run" values="text">{getOwn(STAGE_LABEL, area.stage) ?? area.stage}</DetailRow>}
            {last && <DetailRow label={`left after round ${last.round}`}>{last.left.toFixed(1)}</DetailRow>}
          </DetailList>
          <Passes area={area} />
        </div>
      )}
    </SidebarPanel>
  );
}
