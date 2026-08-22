import RELEASES from 'virtual:changelogs';

/** Matches the `UNRELEASED` label the changelogs plugin stamps on pending
 *  changesets. */
const UNRELEASED = 'Unreleased';

/** Chips beyond this collapse into a "+N" counter. */
const MAX_CHIPS = 3;

/** Release history for every published package, newest first. The entries come
 *  from the packages' CHANGELOG files via the `changelogs` vite plugin, merged
 *  across the fixed version group so each change is stated once. */
export function Releases() {
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
      </header>

      {RELEASES.map((release, i) => (
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
                <Packages names={entry.packages} />
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
      ))}
    </article>
  );
}

function Packages({ names }: { names: readonly string[] }) {
  const shown = names.length <= MAX_CHIPS + 1 ? names : names.slice(0, MAX_CHIPS);
  const hidden = names.length - shown.length;
  return (
    <div className="ckd-release-pkgs" title={names.join(', ')}>
      {shown.map((name) => (
        <span key={name} className="ckd-release-pkg">{name}</span>
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
