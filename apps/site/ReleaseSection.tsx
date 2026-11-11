import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  type ChangelogEntry,
  countGroups,
  GROUPS,
  groupOf,
  matches,
  type ReleaseIndexEntry,
} from '../shared/releases';
import num from '@weasel-js/theme/numeric.module.css';
import { isoDay } from './isoDay';
import { ReleaseEntry } from './ReleaseEntry';

/** Matches the `UNRELEASED` label the changelogs plugin stamps on pending changesets. */
const UNRELEASED = 'Unreleased';

/** Entries already fetched, so a release opened twice renders at once the second time. */
const loaded = new WeakMap<ReleaseIndexEntry, ChangelogEntry[]>();

/** A release's entries, fetched the first time it is open. */
function useEntries(release: ReleaseIndexEntry, open: boolean): ChangelogEntry[] | null {
  const [entries, setEntries] = useState(() => loaded.get(release) ?? null);
  useEffect(() => {
    if (!open || entries) return;
    let live = true;
    void release.load().then((list) => {
      loaded.set(release, list);
      if (live) setEntries(list);
    });
    return () => {
      live = false;
    };
  }, [open, entries, release]);
  return entries;
}

/**
 * One version of the history. Its entries are fetched and mounted only while it is open: the
 * whole history is megabytes of prose and tens of thousands of elements. The cost is that
 * find-in-page cannot reach a closed one.
 */
export function ReleaseSection({
  release,
  lead,
  target,
  selected,
  onToggle,
}: {
  release: ReleaseIndexEntry;
  /** First in the list as filtered: open whenever it becomes so. */
  lead: boolean;
  /** Named by the URL: opened and scrolled to on mount. */
  target: boolean;
  selected: readonly string[];
  onToggle: (name: string) => void;
}) {
  const [open, setOpen] = useState(lead || target);
  const ref = useRef<HTMLDetailsElement>(null);
  const entries = useEntries(release, open);

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

  const counts = countGroups(release.shape, selected);
  const highlights = release.highlights.filter((h) => matches(h.packages, selected));

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
            {isoDay(release.date)}
          </time>
        ) : release.version === UNRELEASED ? (
          <span className="ckd-release-date">merged, not yet published</span>
        ) : null}
        <span className={`ckd-release-count ${num.numeric}`}>
          {counts.map((g) => `${g.count} ${g.label.toLowerCase()}`).join(' · ')}
        </span>
      </summary>

      {open ? (
        <>
          {highlights.length > 0 ? (
            <div className="ckd-release-highlights">
              <p className="ckd-release-highlights-label">
                {release.curated ? 'Highlights' : 'Top changes (not curated)'}
              </p>
              <ul>
                {highlights.map((h) => (
                  <li key={h.id} dangerouslySetInnerHTML={{ __html: h.titleHtml }} />
                ))}
              </ul>
            </div>
          ) : null}
          {entries ? (
            <Groups entries={entries} selected={selected} onToggle={onToggle} />
          ) : (
            <p className="ckd-release-matched">Loading…</p>
          )}
        </>
      ) : null}
    </details>
  );
}

function Groups({
  entries,
  selected,
  onToggle,
}: {
  entries: readonly ChangelogEntry[];
  selected: readonly string[];
  onToggle: (name: string) => void;
}) {
  const shown = entries.filter((e) => matches(e.packages, selected));
  return (
    <>
      {GROUPS.map((group) => {
        const members = shown.filter((e) => groupOf(e.tags) === group.id);
        if (members.length === 0) return null;
        const list = (
          <ul className="ckd-release-entries">
            {members.map((entry) => (
              <ReleaseEntry key={entry.id} entry={entry} selected={selected} onToggle={onToggle} />
            ))}
          </ul>
        );
        return group.folded ? (
          <FoldedGroup key={group.id} label={group.label} count={members.length}>
            {list}
          </FoldedGroup>
        ) : (
          <section key={group.id} className="ckd-release-group">
            <h4 className="ckd-release-group-heading">{group.label}</h4>
            {list}
          </section>
        );
      })}
    </>
  );
}

/** Fixes and internal changes: counted, and mounted only once opened. */
function FoldedGroup({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="ckd-release-group" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={num.numeric}>
        {label} ({count})
      </summary>
      {open ? children : null}
    </details>
  );
}
