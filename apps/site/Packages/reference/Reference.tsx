import type { PackageEntry } from '../../../shared/packageDocs';
import type { PackageReference } from '../../../shared/reference';
import { Loading } from '../Loading';
import { useLoaded } from '../useLoaded';
import { ReferenceView } from './ReferenceView';
import s from './Reference.module.css';

/** What the build left where a package's reference should be when it did not write one. */
type Unbuilt = 'unbuilt';

const pending = new Map<string, Promise<PackageReference | Unbuilt>>();

/**
 * One package's reference, as `npm run build:api` wrote it beside the site.
 * Fetched, not bundled: the reference is built after the site is.
 */
function loadReference(name: string): Promise<PackageReference | Unbuilt> {
  let load = pending.get(name);
  if (!load) {
    const fetched = async (response: Response): Promise<PackageReference | Unbuilt> => {
      if (!response.ok) return 'unbuilt';
      // A dev server with no reference to serve answers any path with the app's own page.
      try {
        return (await response.json()) as PackageReference;
      } catch {
        return 'unbuilt';
      }
    };
    load = fetch(`${import.meta.env.BASE_URL}reference/${name}.json`).then(fetched);
    // A failed fetch is not remembered, so reopening the page tries again.
    load.catch(() => pending.delete(name));
    pending.set(name, load);
  }
  return load;
}

/** A package's API reference: a module's exports, or one export, by what follows `reference/` in the address. */
export function Reference({ pkg, rest }: { pkg: PackageEntry; rest: string }) {
  const reference = useLoaded(loadReference, pkg.name);
  return (
    <Loading value={reference} what="The reference">
      {(loaded) =>
        loaded === 'unbuilt' ? (
          <p className={s.note} role="status">
            The reference for {pkg.specifier} has not been built. <code>npm run build:api</code> writes it.
          </p>
        ) : (
          <ReferenceView reference={loaded} rest={rest} />
        )
      }
    </Loading>
  );
}
