import type { PackageEntry } from '../../shared/packageDocs';
import { packageRoute } from '../../shared/packageRoutes';
import { Prose } from '../Prose';
import { Loading } from './Loading';
import { loadDoc } from './catalog';
import { useLoaded } from './useLoaded';
import s from './Packages.module.css';

/** One of a package's guides, with the others listed above it. An empty `slug` is the first guide. */
export function Guides({ pkg, slug }: { pkg: PackageEntry; slug: string }) {
  const doc = useLoaded(loadDoc, pkg);
  const guide = slug === '' ? pkg.guides[0] : pkg.guides.find((g) => g.slug === slug);
  if (!guide) {
    return (
      <p className={s.note}>
        {pkg.guides.length === 0 ? `${pkg.specifier} has no guides yet.` : `${pkg.specifier} has no guide at this address.`}
      </p>
    );
  }
  return (
    <div className={s.body}>
      {pkg.guides.length > 1 && (
        <ul className={s.inlineList} aria-label="Guides">
          {pkg.guides.map((g) => (
            <li key={g.slug}>
              <a
                href={`#${packageRoute(pkg.name, 'guides', g.slug)}`}
                aria-current={g.slug === guide.slug ? 'page' : undefined}
                className={g.slug === guide.slug ? s.current : undefined}
              >{g.title}</a>
            </li>
          ))}
        </ul>
      )}
      <h3 className={s.guideTitle}>{guide.title}</h3>
      <Loading value={doc} what="This guide">
        {(loaded) => <Prose blocks={loaded.guides[guide.slug] ?? []} />}
      </Loading>
    </div>
  );
}
