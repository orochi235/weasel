import { InlineMarkdown } from '@weasel-js/ui/components/InlineMarkdown';
import type { PackageEntry } from '../../shared/packageDocs';
import {
  PACKAGES_ID, packageRoute, parsePackageRoute, type PackageRoute, type PackageTab,
} from '../../shared/packageRoutes';
import { Guides } from './Guides';
import { Overview } from './Overview';
import { PackageDemos } from './PackageDemos';
import { PACKAGES, PACKAGES_BY_NAME, demosOf } from './catalog';
import { Reference } from './reference/Reference';
import s from './Packages.module.css';

/** The page a package hash names: the index of packages, or one package's overview, guides, reference, or demos. */
export default function Packages({ id }: { id: string }) {
  if (id === PACKAGES_ID) return <PackageIndex />;
  const route = parsePackageRoute(id);
  const pkg = route ? PACKAGES_BY_NAME.get(route.package) : undefined;
  if (!route || !pkg) return null;
  // Keyed so one package's loaded prose never shows under another's name.
  return <PackagePage key={pkg.name} pkg={pkg} route={route} />;
}

function PackageIndex() {
  return (
    <article className={s.page}>
      <header className={s.header}>
        <div className="ckd-eyebrow">Index</div>
        <h2 className={s.title}>Packages</h2>
        <p className="ckd-desc">Every published package: what it is, how to use it, what it exports, and the demos built on it.</p>
      </header>
      <ul className={s.index}>
        {PACKAGES.map((pkg) => (
          <li key={pkg.name}>
            <a className={s.indexName} href={`#${packageRoute(pkg.name)}`}>{pkg.specifier}</a>
            <span className={s.indexAbout}>
              {pkg.since && <strong className={s.since}>since {pkg.since}</strong>}
              <InlineMarkdown text={pkg.description} links="text" />
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

const TAB_LABELS: Record<PackageTab, string> = {
  overview: 'Overview',
  guides: 'Guides',
  reference: 'Reference',
  demos: 'Demos',
};

function PackagePage({ pkg, route }: { pkg: PackageEntry; route: PackageRoute }) {
  const demos = demosOf(pkg);
  // A tab with nothing behind it is left off; its address still answers, and says so.
  const tabs = (Object.keys(TAB_LABELS) as PackageTab[]).filter(
    (tab) => (tab !== 'guides' || pkg.guides.length > 0) && (tab !== 'demos' || demos.length > 0),
  );
  return (
    <article className={s.page}>
      <header className={s.header}>
        <div className="ckd-eyebrow"><a href={`#${PACKAGES_ID}`}>Packages</a></div>
        <div className={s.titleRow}>
          <h2 className={s.title}>{pkg.specifier}</h2>
          <span className={s.version}>v{pkg.version}</span>
        </div>
        <p className="ckd-desc"><InlineMarkdown text={pkg.description} links="text" /></p>
      </header>
      <nav className={s.tabs} aria-label={`${pkg.specifier} pages`}>
        {tabs.map((tab) => (
          <a
            key={tab}
            href={`#${packageRoute(pkg.name, tab)}`}
            className={tab === route.tab ? `${s.tab} ${s.tabActive}` : s.tab}
            aria-current={tab === route.tab ? 'page' : undefined}
          >{TAB_LABELS[tab]}</a>
        ))}
      </nav>
      {route.tab === 'overview' ? <Overview pkg={pkg} /> : null}
      {route.tab === 'guides' ? <Guides pkg={pkg} slug={route.rest} /> : null}
      {route.tab === 'reference' ? <Reference pkg={pkg} rest={route.rest} /> : null}
      {route.tab === 'demos' ? <PackageDemos pkg={pkg} demos={demos} /> : null}
    </article>
  );
}
