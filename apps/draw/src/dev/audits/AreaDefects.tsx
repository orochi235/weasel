import { InlineMarkdown } from '@weasel-js/ui/components/InlineMarkdown';
import { Badge } from '@weasel-js/ui/components/Badge';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import type { Grade } from '@weasel-js/theme';
import { useAreaDefects } from './useAreaDefects';
import type { AuditDefect } from './skulkMap.types';
import s from './AreaDefects.module.css';

const GRADE: Readonly<Record<AuditDefect['verdict'], Grade | undefined>> = {
  fixed: 'success', 'not a defect': undefined, duplicate: undefined, question: 'warn', 'not fixed': 'danger', open: 'info',
};

function Defect({ d }: { d: AuditDefect }) {
  const grade = GRADE[d.verdict];
  return (
    <li className={s.item}>
      <div className={s.head}>
        <Badge shape="pill" size="xs" variant={d.verdict === 'fixed' ? 'solid' : 'outline'} {...(grade ? { grade } : {})}>{d.verdict}</Badge>
        {d.from && <span className={s.from}>{d.from}</span>}
      </div>
      <div className={s.claim}><InlineMarkdown text={d.claim} /></div>
      {d.note && <div className={s.note}><InlineMarkdown text={d.note} /></div>}
    </li>
  );
}

/** What each round found in the picked area and what became of each: the fixer's report once it has one. */
export function AreaDefects({ id, version }: { id: string; version: string }) {
  const state = useAreaDefects(id, version);
  return (
    <SidebarPanel title="Defects">
      <div className={s.id}>{id}</div>
      {state.status === 'loading' && <p className={s.hint}>Reading its rounds…</p>}
      {state.status === 'failed' && <p className={s.hint}>Couldn&apos;t read them: {state.error}</p>}
      {state.status === 'ready' && state.rounds.length === 0 && <p className={s.hint}>No round has read it yet.</p>}
      {state.status === 'ready' && state.rounds.map((r) => (
        <section key={r.round} className={s.round}>
          <h3 className={s.title}>
            Round {r.round}
            <span className={s.hint}>{r.recorded ? '' : r.fixed ? ' · not merged yet' : r.commits ? ' · its fixer stopped before reporting' : ' · no fixer report yet'}</span>
          </h3>
          {r.commits && r.commits.length > 0 && (
            <>
              <p className={s.hint}>Its commits:</p>
              <ul className={s.commits}>{r.commits.map((c, i) => <li key={i}><InlineMarkdown text={c} /></li>)}</ul>
              <p className={s.hint}>What the reviewers found:</p>
            </>
          )}
          {r.items.length === 0 ? <p className={s.hint}>Nothing found.</p> : <ol className={s.list}>{r.items.map((d, i) => <Defect key={i} d={d} />)}</ol>}
        </section>
      ))}
    </SidebarPanel>
  );
}
