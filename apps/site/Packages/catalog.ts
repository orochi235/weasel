import PACKAGES from 'virtual:package-docs';
import type { PackageEntry } from '../../shared/packageDocs';
import { PACKAGES_ID, parsePackageRoute } from '../../shared/packageRoutes';
import { DEMOS, type DemoEntry } from '../registry';

export { PACKAGES };

export const PACKAGES_BY_NAME = new Map(PACKAGES.map((pkg) => [pkg.name, pkg]));

/** True for a hash that names the package index or a page of a package that exists. */
export function isPackagePage(id: string): boolean {
  if (id === PACKAGES_ID) return true;
  const route = parsePackageRoute(id);
  return route !== null && PACKAGES_BY_NAME.has(route.package);
}

/** A package's README and guides. Module-level so it is one function across renders. */
export function loadDoc(pkg: PackageEntry) {
  return pkg.load();
}

/**
 * The demos whose source imports a package, the ones the sidebar files under
 * it first. Which demos those are is read from the imports at build time; the
 * registry is only asked what each one is called.
 */
export function demosOf(pkg: PackageEntry): DemoEntry[] {
  const paths = new Set(pkg.demos);
  const using = DEMOS.filter((demo) => paths.has(demo.path));
  return [...using.filter((demo) => demo.package === pkg.name), ...using.filter((demo) => demo.package !== pkg.name)];
}
