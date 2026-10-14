import type { PackageEntry } from '../../shared/packageDocs';
import { packageRoute } from '../../shared/packageRoutes';
import { Prose } from '../Prose';
import { Loading } from './Loading';
import { PACKAGES_BY_NAME, loadDoc } from './catalog';
import { useLoaded } from './useLoaded';
import s from './Packages.module.css';

/** A package's manifest facts, then its README. */
export function Overview({ pkg }: { pkg: PackageEntry }) {
  const doc = useLoaded(loadDoc, pkg);
  const uses = pkg.uses.filter((name) => PACKAGES_BY_NAME.has(name));
  return (
    <div className={s.body}>
      <dl className={s.facts}>
        <dt>Import from</dt>
        <dd>
          <ul className={s.inlineList}>
            {pkg.entries.map((specifier) => (
              <li key={specifier}>
                <a href={`#${packageRoute(pkg.name, 'reference', specifier.slice(pkg.specifier.length + 1))}`}>
                  <code>{specifier}</code>
                </a>
              </li>
            ))}
          </ul>
        </dd>
        {uses.length > 0 && (
          <>
            <dt>Builds on</dt>
            <dd>
              <ul className={s.inlineList}>
                {uses.map((name) => (
                  <li key={name}><a href={`#${packageRoute(name)}`}><code>{name}</code></a></li>
                ))}
              </ul>
            </dd>
          </>
        )}
      </dl>
      <Loading value={doc} what="This package's README">
        {(loaded) => <Prose blocks={loaded.readme} />}
      </Loading>
    </div>
  );
}
