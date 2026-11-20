import { Icon } from '@weasel-js/ui/components/Icon';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import { icon } from '../../icons.gen';
import type { AuditArea } from './skulkMap.types';
import s from './NextUp.module.css';

/** The areas a run would pick next, in queue order; each picks its cell on the map, and lights it while hovered. */
export function NextUp({ areas, onPick, onLight }: {
  areas: readonly AuditArea[]; onPick: (id: string) => void; onLight: (id: string | null) => void;
}) {
  return (
    <SidebarPanel title="Next up">
      <ol className={s.list}>
        {areas.map((a) => (
          <li key={a.id} value={a.queue ?? undefined}>
            <button
              type="button" className={s.pick} onClick={() => onPick(a.id)}
              onPointerEnter={() => onLight(a.id)} onPointerLeave={() => onLight(null)} onFocus={() => onLight(a.id)} onBlur={() => onLight(null)}
            >
              <span className={s.id}>{a.id}</span>
              <span className={s.files} title={`${a.files} source files`}>
                {a.files}<Icon name={icon('ui:page')} size={11} className={s.page} />
                {a.passes.length === 0 && <span className={s.fresh}>new</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </SidebarPanel>
  );
}
