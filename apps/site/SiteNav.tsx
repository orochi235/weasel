import { PACKAGES_ID, packageRoute } from '../shared/packageRoutes';
import { PACKAGES_BY_NAME } from './Packages/catalog';
import { CATEGORIES, DEMOS, type DemoEntry } from './registry';
import { FEATURES_ID, GET_STARTED_ID, RELEASES_ID, WHATS_NEW_ID } from './routes';

/** The site's own pages, listed ahead of the demos. */
const PAGES = [
  { id: GET_STARTED_ID, label: '🚀 Get started' },
  { id: RELEASES_ID, label: '🏷️ Releases' },
  { id: PACKAGES_ID, label: '📦 Packages' },
  { id: WHATS_NEW_ID, label: '✨ Demo updates' },
  { id: FEATURES_ID, label: '🧩 Canvas features' },
] as const;

interface NavProps {
  activeId: string;
  /** Opens a page as a history entry of its own. */
  onPick: (id: string) => void;
}

/** Every published package, and any package a demo is filed under that is not one. */
const NAV_PACKAGES = [...new Set([...PACKAGES_BY_NAME.keys(), ...DEMOS.flatMap((d) => (d.package ? [d.package] : []))])].sort();

/** The sidebar's links: the site's pages, each demo under its section, and each package with the demos filed under it. */
export function SiteNav({ activeId, onPick }: NavProps) {
  return (
    <nav className="ckd-nav">
      <section className="ckd-nav-section ckd-nav-whatsnew">
        <ul>
          {PAGES.map(({ id, label }) => (
            <li key={id}><NavLink id={id} activeId={activeId} onPick={onPick}>{label}</NavLink></li>
          ))}
        </ul>
      </section>
      {CATEGORIES.map((cat) => (
        <section key={cat} className="ckd-nav-section">
          <h2>{cat}</h2>
          <DemoLinks demos={DEMOS.filter((d) => d.category === cat)} activeId={activeId} onPick={onPick} />
        </section>
      ))}
      {NAV_PACKAGES.length > 0 && (
        <section className="ckd-nav-section">
          <h2>Packages</h2>
          {NAV_PACKAGES.map((pkg) => (
            <section key={pkg} className="ckd-nav-package">
              <h3>
                {PACKAGES_BY_NAME.has(pkg) ? (
                  <a
                    href={`#${packageRoute(pkg)}`}
                    onClick={(e) => { e.preventDefault(); onPick(packageRoute(pkg)); }}
                  >{pkg}</a>
                ) : pkg}
              </h3>
              <DemoLinks demos={DEMOS.filter((d) => d.package === pkg)} activeId={activeId} onPick={onPick} />
            </section>
          ))}
        </section>
      )}
    </nav>
  );
}

function NavLink({ id, activeId, onPick, children }: NavProps & { id: string; children: string }) {
  return (
    <a
      href={`#${id}`}
      className={id === activeId ? 'active' : ''}
      onClick={(e) => { e.preventDefault(); onPick(id); }}
    >{children}</a>
  );
}

function DemoLinks({ demos, activeId, onPick }: NavProps & { demos: DemoEntry[] }) {
  return (
    <ul>
      {demos.map((d) => (
        <li key={d.id}><NavLink id={d.id} activeId={activeId} onPick={onPick}>{d.title}</NavLink></li>
      ))}
    </ul>
  );
}
