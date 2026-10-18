import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import type { PluginOption } from 'vite';
import type { PackageDoc, PackageInfo } from '../apps/shared/packageDocs.ts';
import { publicEntries } from '../typedoc/packageOptions.mjs';
import { namedSpecifiers, packageOf } from './lib/imports.mjs';
import { blocksOf, splitTitle } from './lib/markdownBlocks.ts';
import { publishableWorkspaces } from './lib/workspaces.mjs';
import { tabsFor } from './vite-demo-sources.ts';

const SCOPE = '@weasel-js/';
/** Where a package keeps its guides, relative to the package. One Markdown file each. */
export const GUIDES_DIR = 'docs/guides';
const DEMOS_DIR = 'apps/site/demos';

/**
 * Virtual modules behind the site's package pages (`apps/site/Packages/`):
 *
 *   import PACKAGES from 'virtual:package-docs';
 *   // → PackageEntry[]: every published package's manifest facts, guide
 *   //   titles, and the demos that import it, each with a `load()`.
 *
 * `load()` is a dynamic import of `virtual:package-doc:<name>.js`, that
 * package's README and guides as rendered blocks, so prose is fetched for the
 * one package a visitor opens.
 *
 * Nothing here is listed by hand. A package gets a page by being published, a
 * guide by being a file under `docs/guides/`, and a demo by importing the package.
 */
export function packageDocs(opts: { root?: string } = {}): PluginOption {
  const INDEX_ID = 'virtual:package-docs';
  const RESOLVED_INDEX = '\0' + INDEX_ID;
  // The trailing `.js` keeps vite's transforms from claiming a package named for a file type.
  const DOC_PREFIX = 'virtual:package-doc:';
  const DOC_SUFFIX = '.js';
  const RESOLVED_DOC_PREFIX = '\0' + DOC_PREFIX;
  const root = opts.root ?? process.cwd();

  return {
    name: 'package-docs',
    resolveId(id) {
      if (id === INDEX_ID) return RESOLVED_INDEX;
      if (id.startsWith(DOC_PREFIX)) return '\0' + id;
      return null;
    },
    load(id) {
      if (id === RESOLVED_INDEX) {
        const entries = packageInfos(root).map((info) => {
          const doc = JSON.stringify(DOC_PREFIX + info.name + DOC_SUFFIX);
          return `  { ...${JSON.stringify(info)}, load: () => import(${doc}).then((m) => m.default) }`;
        });
        return `export default [\n${entries.join(',\n')},\n];\n`;
      }
      if (id.startsWith(RESOLVED_DOC_PREFIX)) {
        const name = id.slice(RESOLVED_DOC_PREFIX.length, -DOC_SUFFIX.length);
        return `export default ${JSON.stringify(packageDoc(root, name))};`;
      }
      return null;
    },
    configureServer(server) {
      // A README, a changelog, a guide, a manifest, or a demo's imports: any of them changes what these modules say.
      server.watcher.on('all', (_event, file) => {
        const rel = relative(root, file).replace(/\\/g, '/');
        const pkg = /^packages\/([^/]+)\/(?:README\.md|CHANGELOG\.md|package\.json|docs\/guides\/)/.exec(rel)?.[1];
        if (!pkg && !rel.startsWith(`${DEMOS_DIR}/`)) return;
        const ids = pkg ? [RESOLVED_INDEX, RESOLVED_DOC_PREFIX + pkg + DOC_SUFFIX] : [RESOLVED_INDEX];
        for (const modId of ids) {
          const mod = server.moduleGraph.getModuleById(modId);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
      });
    },
  };
}

/** The oldest version a package's changelog has a section for, or null with no changelog. */
export function firstRelease(dir: string): string | null {
  const file = join(dir, 'CHANGELOG.md');
  if (!existsSync(file)) return null;
  const versions = [...readFileSync(file, 'utf8').matchAll(/^##\s+\[?v?(\d+\.\d+\.\d+[^\]\s]*)/gm)].map((m) => m[1]!);
  return versions.at(-1) ?? null;
}

/** Every published package's facts, by name. */
export function packageInfos(root: string): PackageInfo[] {
  const demos = demosByPackage(root);
  return publishableWorkspaces(root)
    .map(({ dir, manifest }) => {
      const name = basename(dir);
      const deps = { ...(manifest.dependencies as object), ...(manifest.peerDependencies as object) };
      return {
        name,
        specifier: manifest.name,
        version: manifest.version,
        since: firstRelease(dir),
        description: typeof manifest.description === 'string' ? manifest.description : '',
        entries: publicEntries(dir).map((entry: { specifier: string }) => entry.specifier),
        uses: Object.keys(deps).filter((dep) => dep.startsWith(SCOPE)).map((dep) => dep.slice(SCOPE.length)).sort(),
        guides: guideFiles(dir).map(({ slug, file }) => ({
          slug,
          title: splitTitle(readFileSync(file, 'utf8')).title ?? slug,
        })),
        demos: demos.get(name) ?? [],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One package's README and guides, rendered. */
export function packageDoc(root: string, name: string): PackageDoc {
  const dir = resolve(root, 'packages', name);
  const readme = join(dir, 'README.md');
  // The page's own headings are the package (h2) and, over a guide, the guide's title (h3).
  const body = (file: string, under: 2 | 3) => blocksOf(splitTitle(readFileSync(file, 'utf8')).body, under - 1);
  return {
    readme: existsSync(readme) ? body(readme, 2) : [],
    guides: Object.fromEntries(guideFiles(dir).map(({ slug, file }) => [slug, body(file, 3)])),
  };
}

/**
 * A package's guide files in the order they sort. A leading number orders
 * them without being part of the address: `1-recipes.md` is the guide `recipes`.
 */
function guideFiles(packageDir: string): { slug: string; file: string }[] {
  const dir = join(packageDir, GUIDES_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((file) => ({ slug: file.slice(0, -'.md'.length).replace(/^\d+-/, ''), file: join(dir, file) }));
}

/**
 * Which demos exercise which package: a demo belongs to every weasel package
 * its own file, or a file its code panel shows beside it, imports from. A
 * type-only import counts: a demo written against a package's types shows them in use.
 *
 * @returns unscoped package name to repo-relative demo paths
 */
export function demosByPackage(root: string): Map<string, string[]> {
  const dir = resolve(root, DEMOS_DIR);
  const byPackage = new Map<string, string[]>();
  if (!existsSync(dir)) return byPackage;
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.tsx')) continue;
    const demoPath = `${DEMOS_DIR}/${file}`;
    const imported = new Set<string>();
    for (const tab of tabsFor(root, demoPath)) {
      if (tab.language !== 'tsx' && tab.language !== 'ts') continue;
      for (const specifier of namedSpecifiers(readFileSync(resolve(root, tab.path), 'utf8'), tab.path)) {
        if (specifier.startsWith(SCOPE)) imported.add(packageOf(specifier).slice(SCOPE.length));
      }
    }
    for (const name of imported) byPackage.set(name, [...(byPackage.get(name) ?? []), demoPath]);
  }
  return byPackage;
}
