/**
 * The addresses of the site's package pages, as URL hashes without the `#`.
 * The build writes them into reference links and the site reads them back, so
 * both sides use this one grammar:
 *
 *   pkg                                 every package
 *   pkg/<package>                       a package's overview
 *   pkg/<package>/guides/<slug>         one of its guides
 *   pkg/<package>/reference             its API reference
 *   pkg/<package>/reference/<path>      a module of it, or one export
 *   pkg/<package>/demos                 the demos that import it
 */

/** The hash of the page that lists every package. */
export const PACKAGES_ID = 'pkg';

const PREFIX = `${PACKAGES_ID}/`;

export const PACKAGE_TABS = ['overview', 'guides', 'reference', 'demos'] as const;
export type PackageTab = (typeof PACKAGE_TABS)[number];

export interface PackageRoute {
  /** Unscoped package name, `geom`. */
  readonly package: string;
  readonly tab: PackageTab;
  /** What follows the tab: a guide's slug, or a reference path. Empty for the tab itself. */
  readonly rest: string;
}

/** The package page a hash names, or `null` for a hash that is not one. */
export function parsePackageRoute(id: string): PackageRoute | null {
  if (!id.startsWith(PREFIX)) return null;
  const [name, tab = 'overview', ...rest] = id.slice(PREFIX.length).split('/');
  if (!name || !isTab(tab)) return null;
  return { package: name, tab, rest: rest.join('/') };
}

function isTab(tab: string): tab is PackageTab {
  return (PACKAGE_TABS as readonly string[]).includes(tab);
}

/** The hash of one of a package's tabs. The overview is the package's own address. */
export function packageRoute(name: string, tab: PackageTab = 'overview', rest = ''): string {
  if (tab === 'overview') return PREFIX + name;
  return `${PREFIX}${name}/${tab}${rest ? `/${rest}` : ''}`;
}

/**
 * The hash of one export's reference page.
 *
 * @param module the subpath entry it is exported from, `booleans`; empty for the package's root entry
 */
export function symbolRoute(name: string, module: string, symbol: string): string {
  return packageRoute(name, 'reference', module ? `${module}/${symbol}` : symbol);
}

/**
 * A reference path split into the module and the export it names. A path that
 * is itself a module's name is that module's index, which is why the caller
 * says which modules exist.
 */
export function splitReferencePath(
  rest: string,
  modules: readonly string[],
): { module: string; symbol: string | null } {
  if (rest === '' || modules.includes(rest)) return { module: rest, symbol: null };
  const at = rest.lastIndexOf('/');
  return at === -1 ? { module: '', symbol: rest } : { module: rest.slice(0, at), symbol: rest.slice(at + 1) };
}
