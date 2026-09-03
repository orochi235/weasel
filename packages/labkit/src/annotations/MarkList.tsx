import { useAnnotations } from './AnnotationsContext';
import type { AnnotationMeaning } from './types';

/** Props for `<MarkList>`. */
export interface MarkListProps {
  /** The instrument's vocabulary. Omitted, rows carry no status control —
   *  a host that declared none owns what a mark means. */
  meaning?: AnnotationMeaning;
  /** The live config, for answering staleness. */
  config: unknown;
}

/** Every mark on this trial's targets: what it says, and whether it still
 *  describes the picture under it.
 *
 *  Reads the store through the hook, which re-renders on every mutation — so a
 *  mark drawn on a pane appears here without anything wiring the two. */
export function MarkList({ meaning, config }: MarkListProps) {
  const marks = useAnnotations();
  const all = marks.query();
  const statuses = meaning?.statuses ?? [];

  if (all.length === 0) {
    return <div className="lk-mark-list__empty">No marks yet</div>;
  }

  return (
    <ul className="lk-mark-list">
      {all.map((a) => {
        const stale = marks.isStale(a, config);
        return (
          <li className="lk-mark-list__row" key={a.id}>
            <div className="lk-mark-list__head">
              <span className="lk-mark-list__kind">{a.kind}</span>
              <span className="lk-mark-list__target">{a.target}</span>
              {stale ? <span className="lk-mark-list__stale">stale</span> : null}
              <button
                type="button"
                className="lk-mark-list__drop"
                aria-label={`Remove ${a.kind} on ${a.target}`}
                onClick={() => marks.remove(a.id)}
              >
                ×
              </button>
            </div>
            <input
              className="lk-mark-list__title"
              aria-label={`Title of ${a.kind} on ${a.target}`}
              value={a.title ?? ''}
              placeholder="Untitled"
              onChange={(e) => marks.update(a.id, { title: e.target.value })}
            />
            {statuses.length > 0 ? (
              // A native select: it carries role, name and keyboard operability
              // for free, and a sidebar row is not the place to rebuild them.
              <select
                className="lk-mark-list__status"
                aria-label={`Status of ${a.kind} on ${a.target}`}
                value={a.status ?? ''}
                onChange={(e) => marks.update(a.id, { status: e.target.value })}
              >
                <option value="">—</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
