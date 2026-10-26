import { useCallback, useEffect, useMemo, useState } from 'react';
import RELEASES from 'virtual:changelogs';
import num from '@weasel-js/theme/numeric.module.css';
import { Button } from '@weasel-js/ui/components/Button';
import { ReleaseSection } from './ReleaseSection';

/** The filter lives in the query string, not the hash: the hash is the app's
 *  router and it rewrites itself to the bare view id on every change. */
const PARAM = 'pkg';
/** A version to open and scroll to, e.g. `?v=1.9.4#__releases`. */
const VERSION_PARAM = 'v';

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
  const [linked] = useState(() => new URLSearchParams(window.location.search).get(VERSION_PARAM));

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
          <Button size="sm" pressed={selected.length === 0} onClick={() => setSelected([])}>
            All
          </Button>
          {counts.map(([name, count]) => (
            <Button key={name} size="sm" pressed={selected.includes(name)} onClick={() => toggle(name)}>
              {name}
              <span className={`ckd-release-pkg-n ${num.numeric}`}>{count}</span>
            </Button>
          ))}
        </div>

        {selected.length > 0 ? (
          <p className={`ckd-release-matched ${num.numeric}`} aria-live="polite">
            {matched} {matched === 1 ? 'change' : 'changes'} in {selected.join(', ')}
          </p>
        ) : null}
      </header>

      {shown.length === 0 ? (
        <p className="ckd-desc">No changes name those packages.</p>
      ) : (
        shown.map((release, i) => (
          <ReleaseSection
            key={release.version}
            release={release}
            lead={i === 0}
            target={release.version === linked}
            selected={selected}
            onToggle={toggle}
          />
        ))
      )}
    </article>
  );
}
