import RELEASES from 'virtual:changelogs';
import { CURRENT_MAJOR } from '@shared/releaseMajor';
import { OLDER_RELEASES_ID, RELEASES_ID } from './routes';
import { ReleaseHistory, ReleasesPageLink } from './ReleaseHistory';

/** Release history for every published package from `CURRENT_MAJOR` on, newest first. The entries
 *  come from the packages' CHANGELOG files via the `changelogs` vite plugin, merged across the
 *  fixed version group so each change is stated once. Older releases have a page of their own. */
export function Releases() {
  return (
    <ReleaseHistory
      id={RELEASES_ID}
      releases={RELEASES}
      title="Releases"
      empty={`Nothing has been published since ${CURRENT_MAJOR}.0 yet.`}
      description={
        <>
          Every version published since {CURRENT_MAJOR}.0, newest first. All packages release
          together, so one version number moves the whole kit — each change below names the
          packages it touched and what kind of change it is. Each release leads with its
          highlights, then lists breaking changes, new features, and other changes, with fixes
          folded away. Anything merged but not yet on npm leads the list as unreleased.
        </>
      }
      footer={<ReleasesPageLink id={OLDER_RELEASES_ID}>Releases before {CURRENT_MAJOR}.0 →</ReleasesPageLink>}
    />
  );
}
