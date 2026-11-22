import RELEASES from 'virtual:changelogs/older';
import { CURRENT_MAJOR } from '@shared/releaseMajor';
import { OLDER_RELEASES_ID, RELEASES_ID } from './routes';
import { ReleaseHistory, ReleasesPageLink } from './ReleaseHistory';

/** Every release before `CURRENT_MAJOR`, newest first: the history the Releases page leaves out. */
export function OlderReleases() {
  return (
    <ReleaseHistory
      id={OLDER_RELEASES_ID}
      releases={RELEASES}
      title={`Releases before ${CURRENT_MAJOR}.0`}
      empty={`No release predates ${CURRENT_MAJOR}.0.`}
      description={
        <>
          Every version published before {CURRENT_MAJOR}.0, newest first. Each change names the
          packages it touched and what kind of change it is.
        </>
      }
      footer={<ReleasesPageLink id={RELEASES_ID}>← Releases since {CURRENT_MAJOR}.0</ReleasesPageLink>}
    />
  );
}
