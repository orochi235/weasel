import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWindowEvent } from '@weasel-js/react';
import RELEASES from 'virtual:changelogs';
import num from '@weasel-js/theme/numeric.module.css';
import { type Filter, matches, NO_FILTER, type Tag, TAGS } from '@shared/releases';
import { describeFilter, ReleaseFilter } from './ReleaseFilter';
import { ReleaseSection } from './ReleaseSection';
import './Releases.css';
import { hasOwnKey } from '@weasel-js/registry';

/** The filter lives in the query string, not the hash: the hash is the app's
 *  router and it rewrites itself to the bare view id on every change. */
const PACKAGE_PARAM = 'pkg';
const TAG_PARAM = 'tag';
/** A version to open and scroll to, e.g. `?v=1.9.4#__releases`. */
const VERSION_PARAM = 'v';

function readList(params: URLSearchParams, name: string): string[] {
  const raw = params.get(name);
  return raw ? raw.split(',').filter(Boolean) : [];
}

function readFilter(): Filter {
  const params = new URLSearchParams(window.location.search);
  return {
    packages: readList(params, PACKAGE_PARAM),
    tags: readList(params, TAG_PARAM).filter((t): t is Tag => hasOwnKey(TAGS, t)),
  };
}

function readVersion(): string | null {
  return new URLSearchParams(window.location.search).get(VERSION_PARAM);
}

/** Write this view's query params, each dropped when it has no value. */
function writeParams(filter: Filter, version: string | null): void {
  const url = new URL(window.location.href);
  const params = [[PACKAGE_PARAM, filter.packages], [TAG_PARAM, filter.tags], [VERSION_PARAM, version ? [version] : []]] as const;
  for (const [name, list] of params) {
    if (list.length === 0) url.searchParams.delete(name);
    else url.searchParams.set(name, list.join(','));
  }
  window.history.replaceState(null, '', url);
}

function toggled<T extends string>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item].sort();
}

/** Release history for every published package, newest first. The entries come
 *  from the packages' CHANGELOG files via the `changelogs` vite plugin, merged
 *  across the fixed version group so each change is stated once; each release's
 *  entries load when it is opened. */
export function Releases() {
  const [filter, setFilter] = useState<Filter>(readFilter);
  /** The version the URL named at mount, kept in the URL while this view is shown. */
  const [version] = useState(readVersion);
  const [linked, setLinked] = useState(version);
  // The link is spent once the first render has opened its section: a section that a filter
  // change remounts later is not being linked to.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- consumes the deep link after the mount that used it
  useEffect(() => setLinked(null), []);

  useWindowEvent('popstate', () => setFilter(readFilter()));

  useEffect(() => {
    writeParams(filter, version);
  }, [filter, version]);
  // The params are this view's: the page navigated to next keeps the rest of the query, not them.
  useEffect(() => () => writeParams(NO_FILTER, null), []);

  const togglePackage = useCallback((name: string) => {
    setFilter((f) => ({ ...f, packages: toggled(f.packages, name) }));
  }, []);
  const toggleTag = useCallback((tag: Tag) => {
    setFilter((f) => ({ ...f, tags: toggled(f.tags, tag) }));
  }, []);

  /** Every package and tag that appears anywhere in the history, with how many entries carry
   *  it, so a chip can say how much filtering to it would leave. Tags keep their `TAGS` order. */
  const [packageCounts, tagCounts] = useMemo(() => {
    const byPackage = new Map<string, number>();
    const byTag = new Map<Tag, number>();
    for (const release of RELEASES) {
      for (const entry of release.shape) {
        for (const name of entry.packages) byPackage.set(name, (byPackage.get(name) ?? 0) + 1);
        for (const tag of entry.tags) byTag.set(tag, (byTag.get(tag) ?? 0) + 1);
      }
    }
    return [
      [...byPackage].sort(([a], [b]) => a.localeCompare(b)),
      (Object.keys(TAGS) as Tag[]).filter((t) => byTag.has(t)).map((t) => [t, byTag.get(t)!] as const),
    ] as const;
  }, []);

  const shown = useMemo(
    () => RELEASES.filter((release) => release.shape.some((e) => matches(e, filter))),
    [filter],
  );

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

  const matched = shown.reduce((n, r) => n + r.shape.filter((e) => matches(e, filter)).length, 0);
  const summary = describeFilter(filter, matched);

  return (
    <article className="ckd-demo ckd-releases">
      <header>
        <div className="ckd-eyebrow">Index</div>
        <h2>Releases</h2>
        <p className="ckd-desc">
          Every published version, newest first. All packages release together, so one
          version number moves the whole kit — each change below names the packages it
          touched and what kind of change it is. Each release leads with its highlights,
          then lists breaking changes, new features and other changes, with fixes folded
          away. Anything merged but not yet on npm leads the list as unreleased.
        </p>

        <ReleaseFilter
          filter={filter}
          packageCounts={packageCounts}
          tagCounts={tagCounts}
          onTogglePackage={togglePackage}
          onToggleTag={toggleTag}
          onClear={() => setFilter(NO_FILTER)}
        />

        {summary ? (
          <p className={`ckd-release-matched ${num.numeric}`} aria-live="polite">
            {summary}
          </p>
        ) : null}
      </header>

      {shown.length === 0 ? (
        <p className="ckd-desc">No changes match that filter.</p>
      ) : (
        shown.map((release, i) => (
          <ReleaseSection
            key={release.version}
            release={release}
            lead={i === 0}
            target={release.version === linked}
            filter={filter}
            onTogglePackage={togglePackage}
            onToggleTag={toggleTag}
          />
        ))
      )}
    </article>
  );
}
