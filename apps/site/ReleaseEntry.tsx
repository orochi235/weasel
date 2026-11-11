import { useState } from 'react';
import { type ChangelogEntry, type Filter, type Tag, TAGS } from '../shared/releases';
import { Button } from '@weasel-js/ui/components/Button';

/** One change: its tags and packages, its title, and its body folded behind the title. */
export function ReleaseEntry({
  entry,
  filter,
  onTogglePackage,
  onToggleTag,
}: {
  entry: ChangelogEntry;
  filter: Filter;
  onTogglePackage: (name: string) => void;
  onToggleTag: (tag: Tag) => void;
}) {
  return (
    <li className="ckd-release-entry">
      <div className="ckd-release-meta">
        {entry.tags.map((tag) => (
          <TagChip key={tag} tag={tag} pressed={filter.tags.includes(tag)} onToggle={onToggleTag} />
        ))}
        {entry.packages.map((name) => (
          <Button key={name} size="sm" pressed={filter.packages.includes(name)} onClick={() => onTogglePackage(name)}>
            {name}
          </Button>
        ))}
      </div>
      <Prose entry={entry} />
    </li>
  );
}

/** A tag on one change, which filters the page to that tag as a package chip filters to its package. */
function TagChip({ tag, pressed, onToggle }: { tag: Tag; pressed: boolean; onToggle: (tag: Tag) => void }) {
  return (
    <Button
      size="sm"
      className={`ckd-release-tag${tag === 'breaking' ? ' is-breaking' : ''}`}
      pressed={pressed}
      tooltip={TAGS[tag]}
      onClick={() => onToggle(tag)}
    >
      {tag}
    </Button>
  );
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
