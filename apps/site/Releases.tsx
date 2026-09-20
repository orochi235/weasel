import { useCallback, useEffect, useMemo, useState } from 'react';
import RELEASES from 'virtual:changelogs';

/** Matches the `UNRELEASED` label the changelogs plugin stamps on pending
 *  changesets. */
const UNRELEASED = 'Unreleased';

/** Chips beyond this collapse into a "+N" counter. */
const MAX_CHIPS = 3;

/** The filter lives in the query string, not the hash: the hash is the app's
 *  router and it rewrites itself to the bare view id on every change. */
const PARAM = 'pkg';

function readParam(): string[] {
  const raw = new URLSearchParams(window.location.search).get(PARAM);
  return raw ? raw.split(',').filter(Boolean) : [];
}

function writeParam(names: readonly string[]): void {
  const url = new URL(window.location.href);
  if (names.length === 0) url.searchParams.delete(PARAM);
  else url.searchParams.set(PARAM, names.join(','));
  window.history.replaceState(null, '', url);
}

/** Release history for every published package, newest first. The entries come
 *  from the packages' CHANGELOG files via the `changelogs` vite plugin, merged
 *  across the fixed version group so each change is stated once. */
export function Releases() {
  const [selected, setSelected] = useState<string[]>(readParam);

  useEffect(() => {
    const onPop = () => setSelected(readParam());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    writeParam(selected);
  }, [selected]);

  const toggle = useCallback((name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name].sort(),
    );
  }, []);

  /** Every package that appears anywhere in the history, with how many entries
   *  name it, so a chip can say how much filtering to it would leave. */
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const release of RELEASES) {
      for (const entry of release.entries) {
        for (const name of entry.packages) map.set(name, (map.get(name) ?? 0) + 1);
      }
    }
    return [...map].sort(([a], [b]) => a.localeCompare(b));
  }, []);

  /** An entry survives if it names any selected package — union, not
   *  intersection: one changeset rarely touches two packages for the same
   *  reason, so intersecting almost always empties the list. */
  const shown = useMemo(() => {
    if (selected.length === 0) return RELEASES;
    return RELEASES.map((release) => ({
      ...release,
      entries: release.entries.filter((e) => e.packages.some((p) => selected.includes(p))),
    })).filter((release) => release.entries.length > 0);
  }, [selected]);

  if (RELEASES.length === 0) {
    return (
      <article className="ckd-demo ckd-releases">
        <header>
          <div className="ckd-eyebrow">Index</div>
          <h2>Releases</h2>
          <p className="ckd-desc">No changelog entries found.</p>
        </header>
      </article>
    );
  }

  const matched = shown.reduce((n, r) => n + r.entries.length, 0);

  return (
    <article className="ckd-demo ckd-releases">
      <header>
        <div className="ckd-eyebrow">Index</div>
        <h2>Releases</h2>
        <p className="ckd-desc">
          Every published version, newest first. All packages release together, so one
          version number moves the whole kit — each change below names the packages it
          touched. Anything merged but not yet on npm leads the list as unreleased.
        </p>

        <div className="ckd-release-filter" role="group" aria-label="Filter by package">
          <button
            type="button"
            className={`ckd-release-pkg is-filter${selected.length === 0 ? ' is-on' : ''}`}
            aria-pressed={selected.length === 0}
            onClick={() => setSelected([])}
          >
            All
          </button>
          {counts.map(([name, count]) => (
            <button
              key={name}
              type="button"
              className={`ckd-release-pkg is-filter${selected.includes(name) ? ' is-on' : ''}`}
              aria-pressed={selected.includes(name)}
              onClick={() => toggle(name)}
            >
              {name}
              <span className="ckd-release-pkg-n">{count}</span>
            </button>
          ))}
        </div>

        {selected.length > 0 ? (
          <p className="ckd-release-matched" aria-live="polite">
            {matched} {matched === 1 ? 'change' : 'changes'} in {selected.join(', ')}
          </p>
        ) : null}
      </header>

      {shown.length === 0 ? (
        <p className="ckd-desc">No changes name those packages.</p>
      ) : (
        shown.map((release, i) => (
          <details
            key={release.version}
            className={`ckd-release${release.version === UNRELEASED ? ' is-unreleased' : ''}`}
            open={i === 0}
          >
            <summary className="ckd-release-summary">
              <h3 className="ckd-release-version">{release.version}</h3>
              {release.date ? (
                <time className="ckd-release-date" dateTime={release.date}>
                  {formatDate(release.date)}
                </time>
              ) : release.version === UNRELEASED ? (
                <span className="ckd-release-date">merged, not yet published</span>
              ) : null}
              <span className="ckd-release-count">
                {release.entries.length} {release.entries.length === 1 ? 'change' : 'changes'}
              </span>
            </summary>

            <ul className="ckd-release-entries">
              {release.entries.map((entry) => (
                <li key={entry.id} className="ckd-release-entry">
                  <Packages names={entry.packages} selected={selected} onToggle={toggle} />
                  {entry.titleHtml ? (
                    <p
                      className="ckd-release-title"
                      dangerouslySetInnerHTML={{ __html: entry.titleHtml }}
                    />
                  ) : null}
                  {entry.bodyHtml ? (
                    <div
                      className="ckd-release-body"
                      dangerouslySetInnerHTML={{ __html: entry.bodyHtml }}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        ))
      )}
    </article>
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
  const shown = names.length <= MAX_CHIPS + 1 ? names : names.slice(0, MAX_CHIPS);
  const hidden = names.length - shown.length;
  return (
    <div className="ckd-release-pkgs" title={names.join(', ')}>
      {shown.map((name) => (
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
      {hidden > 0 ? <span className="ckd-release-pkg is-more">+{hidden}</span> : null}
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
