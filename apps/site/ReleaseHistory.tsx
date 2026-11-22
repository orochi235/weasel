import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useWindowEvent } from '@weasel-js/react';
import num from '@weasel-js/theme/numeric.module.css';
import { type Filter, matches, NO_FILTER, type ReleaseIndexEntry, type Tag, TAGS } from '@shared/releases';
import { hasOwnKey } from '@weasel-js/registry';
import { isReleasesPage, VERSION_PARAM } from './routes';
import { describeFilter, ReleaseFilter } from './ReleaseFilter';
import { ReleaseSection } from './ReleaseSection';
import './Releases.css';

/** The filter lives in the query string, not the hash: the hash is the app's
 *  router and it rewrites itself to the bare view id on every change. */
const PACKAGE_PARAM = 'pkg';
const TAG_PARAM = 'tag';

type Counts = readonly [packages: readonly (readonly [string, number])[], tags: readonly (readonly [Tag, number])[]];

/** Every package and tag that appears anywhere in `releases`, with how many entries carry it,
 *  so a chip can say how much filtering to it would leave. Tags keep their `TAGS` order. */
function countsIn(releases: readonly ReleaseIndexEntry[]): Counts {
  const byPackage = new Map<string, number>();
  const byTag = new Map<Tag, number>();
  for (const release of releases) {
    for (const entry of release.shape) {
      for (const name of entry.packages) byPackage.set(name, (byPackage.get(name) ?? 0) + 1);
      for (const tag of entry.tags) byTag.set(tag, (byTag.get(tag) ?? 0) + 1);
    }
  }
  return [
    [...byPackage].sort(([a], [b]) => a.localeCompare(b)),
    (Object.keys(TAGS) as Tag[]).filter((t) => byTag.has(t)).map((t) => [t, byTag.get(t)!] as const),
  ];
}

function readList(params: URLSearchParams, name: string): string[] {
  const raw = params.get(name);
  return raw ? raw.split(',').filter(Boolean) : [];
}

function readFilter(known: ReadonlySet<string>): Filter {
  const params = new URLSearchParams(window.location.search);
  return {
    packages: readList(params, PACKAGE_PARAM).filter((p) => known.has(p)),
    tags: readList(params, TAG_PARAM).filter((t): t is Tag => hasOwnKey(TAGS, t)),
  };
}

/** The version `?v=` names, when it is one this page lists: the other page's is not kept here. */
function readVersion(releases: readonly ReleaseIndexEntry[]): string | null {
  const version = new URLSearchParams(window.location.search).get(VERSION_PARAM);
  return releases.some((r) => r.version === version) ? version : null;
}

function currentPage(): string {
  return window.location.hash.replace(/^#/, '');
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

/** Open the other release history page, keeping the filter but not the version. */
function openReleasesPage(id: string): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(VERSION_PARAM);
  url.hash = id;
  window.history.pushState(null, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** A link to the other release history page. */
export function ReleasesPageLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p className="ckd-releases-other">
      <a
        href={`#${id}`}
        onClick={(e) => {
          e.preventDefault();
          openReleasesPage(id);
        }}
      >
        {children}
      </a>
    </p>
  );
}

/** A release history, newest first, with its filter and `?v=` deep link. Each release's
 *  entries load when it is opened. `footer` follows the list however much of it is shown. */
export function ReleaseHistory({
  releases,
  title,
  description,
  empty,
  footer,
}: {
  releases: readonly ReleaseIndexEntry[];
  title: string;
  description: ReactNode;
  /** Said in place of the list when `releases` is empty. */
  empty: string;
  footer: ReactNode;
}) {
  const [packageCounts, tagCounts] = useMemo(() => countsIn(releases), [releases]);
  const known = useMemo(() => new Set(packageCounts.map(([name]) => name)), [packageCounts]);
  const [filter, setFilter] = useState<Filter>(() => readFilter(known));
  /** The version the URL named at mount, kept in the URL while this view is shown. */
  const [version] = useState(() => readVersion(releases));
  const [linked, setLinked] = useState(version);
  // The link is spent once the first render has opened its section: a section that a filter
  // change remounts later is not being linked to.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- consumes the deep link after the mount that used it
  useEffect(() => setLinked(null), []);

  useWindowEvent('popstate', () => setFilter(readFilter(known)));

  useEffect(() => {
    writeParams(filter, version);
  }, [filter, version]);
  // The params are this view's: the page navigated to next keeps the rest of the query, not them.
  // The other release page reads the same filter, so it keeps them.
  useEffect(
    () => () => {
      if (!isReleasesPage(currentPage())) writeParams(NO_FILTER, null);
    },
    [],
  );

  const togglePackage = useCallback((name: string) => {
    setFilter((f) => ({ ...f, packages: toggled(f.packages, name) }));
  }, []);
  const toggleTag = useCallback((tag: Tag) => {
    setFilter((f) => ({ ...f, tags: toggled(f.tags, tag) }));
  }, []);

  const shown = useMemo(
    () => releases.filter((release) => release.shape.some((e) => matches(e, filter))),
    [releases, filter],
  );

  if (releases.length === 0) {
    return (
      <article className="ckd-demo ckd-releases">
        <header>
          <div className="ckd-eyebrow">Index</div>
          <h2>{title}</h2>
          <p className="ckd-desc">{empty}</p>
        </header>
        {footer}
      </article>
    );
  }

  const matched = shown.reduce((n, r) => n + r.shape.filter((e) => matches(e, filter)).length, 0);
  const summary = describeFilter(filter, matched);

  return (
    <article className="ckd-demo ckd-releases">
      <header>
        <div className="ckd-eyebrow">Index</div>
        <h2>{title}</h2>
        <p className="ckd-desc">{description}</p>

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
      {footer}
    </article>
  );
}
