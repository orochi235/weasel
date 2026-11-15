import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { useMemo } from 'react';
import { isoDay } from './isoDay';
import { DEMOS, placeOf, type DemoEntry } from './registry';
import s from './WhatsNew.module.css';

interface Props {
  onSelect: (id: string) => void;
}

function DateCell({ iso }: { iso: string | undefined }) {
  if (!iso) return <span className={s.empty}>—</span>;
  return (
    <time dateTime={iso} title={iso}>
      {isoDay(iso)}
    </time>
  );
}

/** Newest change first. */
const BY_LAST_MODIFIED = { columnId: 'lastModified', direction: 'desc' } as const;

/** "Demo updates" view — a sortable table of every demo with creation +
 *  last-modified dates. Linked from the sidebar at the top of the nav. */
export function WhatsNew({ onSelect }: Props) {
  const columns = useMemo((): DataGridColumn<DemoEntry>[] => [
    {
      id: 'title',
      header: 'Demo',
      render: (d) => (
        <a href={`#${d.id}`} className={s.link} onClick={(e) => { e.preventDefault(); onSelect(d.id); }}>
          {d.title}
        </a>
      ),
    },
    { id: 'place', header: 'Filed under', accessor: placeOf },
    { id: 'created', header: 'Created', render: (d) => <DateCell iso={d.created} /> },
    { id: 'lastModified', header: 'Last modified', render: (d) => <DateCell iso={d.lastModified} /> },
  ], [onSelect]);

  return (
    <article className="ckd-demo">
      <header>
        <div className="ckd-eyebrow">Index</div>
        <h2>Demo updates</h2>
        <p className="ckd-desc">Every demo in this kit, sortable by creation or last-modified date.</p>
      </header>
      <DataGrid className={s.grid} rows={DEMOS} columns={columns} defaultSort={BY_LAST_MODIFIED} />
    </article>
  );
}
