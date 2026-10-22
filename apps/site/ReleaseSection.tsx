import { useEffect, useRef, useState } from 'react';
import type { ChangelogEntry, Release } from '../shared/releases';
import num from '@weasel-js/theme/numeric.module.css';

/** Matches the `UNRELEASED` label the changelogs plugin stamps on pending
 *  changesets. */
const UNRELEASED = 'Unreleased';

/**
 * One version of the history. Its entries mount only while it is open: the
 * whole history is tens of thousands of elements, nearly all of them inside
 * closed `<details>`. The cost is that find-in-page cannot reach a closed one.
 */
export function ReleaseSection({
  release,
  lead,
  target,
  selected,
  onToggle,
}: {
  release: Release;
  /** First in the list as filtered: open whenever it becomes so. */
  lead: boolean;
  /** Named by the URL: opened and scrolled to on mount. */
  target: boolean;
  selected: readonly string[];
  onToggle: (name: string) => void;
}) {
  const [open, setOpen] = useState(lead || target);
  const ref = useRef<HTMLDetailsElement>(null);

  const [wasLead, setWasLead] = useState(lead);
  if (lead !== wasLead) {
    setWasLead(lead);
    if (lead) setOpen(true);
  }

  // Only the version in the URL at mount is a deep link.
  const [scrollTo] = useState(target);
  useEffect(() => {
    if (scrollTo) ref.current?.scrollIntoView({ block: 'start' });
  }, [scrollTo]);

  return (
    <details
      ref={ref}
      className={`ckd-release${release.version === UNRELEASED ? ' is-unreleased' : ''}`}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="ckd-release-summary">
        <h3 className={`ckd-release-version ${num.numeric}`}>{release.version}</h3>
        {release.date ? (
          <time className={`ckd-release-date ${num.numeric}`} dateTime={release.date}>
            {formatDate(release.date)}
          </time>
        ) : release.version === UNRELEASED ? (
          <span className="ckd-release-date">merged, not yet published</span>
        ) : null}
        <span className="ckd-release-count">
          {release.entries.length} {release.entries.length === 1 ? 'change' : 'changes'}
        </span>
      </summary>

      {open ? (
        <ul className="ckd-release-entries">
          {release.entries.map((entry) => (
            <li key={entry.id} className="ckd-release-entry">
              <Packages names={entry.packages} selected={selected} onToggle={onToggle} />
              <Entry entry={entry} />
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}

function Entry({ entry }: { entry: ChangelogEntry }) {
  const [open, setOpen] = useState(false);
  if (entry.titleHtml && entry.bodyHtml) {
    return (
      <details
        className="ckd-release-change"
        open={open}
        onToggle={(e) => setOpen(e.currentTarget.open)}
      >
        <summary className="ckd-release-title">
          <span dangerouslySetInnerHTML={{ __html: entry.titleHtml }} />
        </summary>
        {open ? (
          <div className="ckd-release-body" dangerouslySetInnerHTML={{ __html: entry.bodyHtml }} />
        ) : null}
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

function Packages({
  names,
  selected,
  onToggle,
}: {
  names: readonly string[];
  selected: readonly string[];
  onToggle: (name: string) => void;
}) {
  return (
    <div className="ckd-release-pkgs">
      {names.map((name) => (
        <button
          key={name}
          type="button"
          className={`ckd-release-pkg is-filter${selected.includes(name) ? ' is-on' : ''}`}
          aria-pressed={selected.includes(name)}
          onClick={() => onToggle(name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
