import { useMemo, useState } from 'react';
import { DEMOS, type DemoEntry } from './registry';

type SortKey = 'title' | 'category' | 'created' | 'lastModified';
type SortDir = 'asc' | 'desc';

interface Props {
  onSelect: (id: string) => void;
}

/** "What's new" view — a sortable table of every demo with creation +
 *  last-modified dates. Linked from the sidebar at the top of the nav.
 *  Default sort: `lastModified` descending, so the latest changes top
 *  the list. Click any column header to re-sort. */
export function WhatsNew({ onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('lastModified');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => sortDemos(DEMOS, sortKey, sortDir), [sortKey, sortDir]);

  const cycle = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      // Date columns default to desc (newest first); text columns to asc.
      setSortDir(key === 'created' || key === 'lastModified' ? 'desc' : 'asc');
    }
  };

  return (
    <article className="ckd-demo ckd-whatsnew">
      <header>
        <div className="ckd-eyebrow">Index</div>
        <h2>What's new</h2>
        <p className="ckd-desc">Every demo in this kit, sortable by creation or last-modified date.</p>
      </header>

      <div className="ckd-whatsnew-tablewrap">
        <table className="ckd-whatsnew-table">
          <thead>
            <tr>
              <Th label="Demo" colKey="title" sortKey={sortKey} sortDir={sortDir} onClick={cycle} />
              <Th label="Category" colKey="category" sortKey={sortKey} sortDir={sortDir} onClick={cycle} />
              <Th label="Created" colKey="created" sortKey={sortKey} sortDir={sortDir} onClick={cycle} />
              <Th label="Last modified" colKey="lastModified" sortKey={sortKey} sortDir={sortDir} onClick={cycle} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={d.id}>
                <td>
                  <a
                    href={`#${d.id}`}
                    className="ckd-whatsnew-link"
                    onClick={(e) => { e.preventDefault(); onSelect(d.id); }}
                  >
                    {d.title}
                  </a>
                </td>
                <td>{d.category}</td>
                <td><DateCell iso={d.created} /></td>
                <td><DateCell iso={d.lastModified} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function Th({
  label, colKey, sortKey, sortDir, onClick,
}: {
  label: string;
  colKey: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (key: SortKey) => void;
}) {
  const active = colKey === sortKey;
  const arrow = active ? (sortDir === 'asc' ? '▲' : '▼') : '';
  return (
    <th>
      <button
        type="button"
        className={`ckd-whatsnew-th${active ? ' is-active' : ''}`}
        onClick={() => onClick(colKey)}
      >
        {label}{arrow ? ` ${arrow}` : ''}
      </button>
    </th>
  );
}

function DateCell({ iso }: { iso: string | undefined }) {
  if (!iso) return <span className="ckd-whatsnew-empty">—</span>;
  const date = new Date(iso);
  return (
    <time dateTime={iso} title={iso}>
      {formatShortDate(date)}
    </time>
  );
}

function formatShortDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sortDemos(
  entries: readonly DemoEntry[],
  key: SortKey,
  dir: SortDir,
): DemoEntry[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...entries].sort((a, b) => {
    const av = (a[key] ?? '') as string;
    const bv = (b[key] ?? '') as string;
    // Empty strings sort as the "smallest" value regardless of direction
    // so undated entries always trail (which is what consumers expect:
    // freshly-created, ungit-tracked demos sit at the bottom).
    if (av === bv) return 0;
    if (av === '') return 1;
    if (bv === '') return -1;
    return av.localeCompare(bv) * sign;
  });
}
