import { useState } from 'react';
import type { ChangelogEntry, Tag } from '../shared/releases';
import { Button } from '@weasel-js/ui/components/Button';

/** One change: its tags and packages, its title, and its body folded behind the title. */
export function ReleaseEntry({
  entry,
  selected,
  onToggle,
}: {
  entry: ChangelogEntry;
  selected: readonly string[];
  onToggle: (name: string) => void;
}) {
  return (
    <li className="ckd-release-entry">
      <div className="ckd-release-meta">
        {entry.tags.map((tag) => (
          <TagChip key={tag} tag={tag} />
        ))}
        {entry.packages.map((name) => (
          <Button key={name} size="sm" pressed={selected.includes(name)} onClick={() => onToggle(name)}>
            {name}
          </Button>
        ))}
      </div>
      <Prose entry={entry} />
    </li>
  );
}

function TagChip({ tag }: { tag: Tag }) {
  return <span className={`ckd-release-tag${tag === 'breaking' ? ' is-breaking' : ''}`}>{tag}</span>;
}

function Prose({ entry }: { entry: ChangelogEntry }) {
  const [open, setOpen] = useState(false);
  if (entry.titleHtml && entry.bodyHtml) {
    return (
      <details className="ckd-release-change" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="ckd-release-title">
          <span dangerouslySetInnerHTML={{ __html: entry.titleHtml }} />
        </summary>
        {open ? <div className="ckd-release-body" dangerouslySetInnerHTML={{ __html: entry.bodyHtml }} /> : null}
      </details>
    );
  }
  return (
    <>
      {entry.titleHtml ? (
        <p className="ckd-release-title" dangerouslySetInnerHTML={{ __html: entry.titleHtml }} />
      ) : null}
      {entry.bodyHtml ? (
        <div className="ckd-release-body" dangerouslySetInnerHTML={{ __html: entry.bodyHtml }} />
      ) : null}
    </>
  );
}
