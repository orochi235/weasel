import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  type ChangelogEntry,
  countGroups,
  type Filter,
  GROUPS,
  groupOf,
  matches,
  type ReleaseIndexEntry,
  type Tag,
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
  filter,
  onTogglePackage,
  onToggleTag,
}: {
  release: ReleaseIndexEntry;
  /** First in the list as filtered: open whenever it becomes so. */
  lead: boolean;
  /** Named by the URL: opened and scrolled to on mount. */
  target: boolean;
  filter: Filter;
  onTogglePackage: (name: string) => void;
  onToggleTag: (tag: Tag) => void;
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

  const counts = countGroups(release.shape, filter);
  const highlights = release.highlights.filter((h) => matches(h, filter));

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
        <ReleaseCount counts={counts} />
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
            <Groups entries={entries} filter={filter} onTogglePackage={onTogglePackage} onToggleTag={onToggleTag} />
          ) : (
            <p className="ckd-release-matched">Loading…</p>
          )}
        </>
      ) : null}
    </details>
  );
}

/** The release's total, with its per-group breakdown on a smaller line below. */
function ReleaseCount({ counts }: { counts: readonly { id: string; label: string; count: number }[] }) {
  const total = counts.reduce((sum, g) => sum + g.count, 0);
  if (total === 0) return null;
  return (
    <span className={`ckd-release-count ${num.numeric}`}>
      <span className="ckd-release-total">
        {total} {total === 1 ? 'change' : 'changes'}
      </span>
      {counts.length > 1 ? (
        <span className="ckd-release-breakdown">
          {counts.map((g) => `${g.count} ${g.label.toLowerCase()}`).join(' · ')}
        </span>
      ) : null}
    </span>
  );
}

function Groups({
  entries,
  filter,
  onTogglePackage,
  onToggleTag,
}: {
  entries: readonly ChangelogEntry[];
  filter: Filter;
  onTogglePackage: (name: string) => void;
  onToggleTag: (tag: Tag) => void;
}) {
  const shown = entries.filter((e) => matches(e, filter));
  // A tag filter asks for exactly these entries, so folding them away would hide the answer.
  const fold = filter.tags.length === 0;
  return (
    <>
      {GROUPS.map((group) => {
        const members = shown.filter((e) => groupOf(e.tags) === group.id);
        if (members.length === 0) return null;
        const list = (
          <ul className="ckd-release-entries">
            {members.map((entry) => (
              <ReleaseEntry
                key={entry.id}
                entry={entry}
                filter={filter}
                onTogglePackage={onTogglePackage}
                onToggleTag={onToggleTag}
              />
            ))}
          </ul>
        );
        return group.folded && fold ? (
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
