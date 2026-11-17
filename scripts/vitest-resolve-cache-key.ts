import { existsSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

interface Alias {
  find: string | RegExp;
  replacement: string;
}

const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"\n]+)['"]/g;

/** The package a bare specifier names (`@scope/name` or `name`), or null for a relative, absolute,
 *  `node:`, virtual or URL one. */
export function packageOf(specifier: string): string | null {
  if (/^(?:[./\0]|[a-z][a-z0-9+.-]*:)/i.test(specifier)) return null;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!;
}

const aliased = (specifier: string, aliases: readonly Alias[]) =>
  aliases.some(({ find }) => (typeof find === 'string'
    ? specifier === find || specifier.startsWith(`${find}/`)
    : find.test(specifier)));

/** Where Node's walk up from `dir` finds `pkg`, symlinks resolved; memoized per directory. */
function installedAt(dir: string, pkg: string, memo: Map<string, string>): string {
  const key = `${dir}\0${pkg}`;
  let found = memo.get(key);
  if (found !== undefined) return found;
  const candidate = join(dir, 'node_modules', pkg);
  if (existsSync(join(candidate, 'package.json'))) found = realpathSync(candidate);
  else found = dirname(dir) === dir ? `?${pkg}` : installedAt(dirname(dir), pkg, memo);
  memo.set(key, found);
  return found;
}

/**
 * Where every package `code`, the source of `file`, imports by bare specifier is installed, as one
 * string: moving one (a nested copy appearing or vanishing) changes it. Specifiers an alias answers
 * are left out, since an alias never reads the install.
 */
export function bareImportKey(
  file: string, code: string, aliases: readonly Alias[] = [], memo = new Map<string, string>(),
): string {
  const packages = new Set<string>();
  for (const [, specifier] of code.matchAll(SPECIFIER)) {
    const pkg = packageOf(specifier!);
    if (pkg && !aliased(specifier!, aliases)) packages.add(pkg);
  }
  const dir = dirname(file);
  return [...packages].sort().map((pkg) => installedAt(dir, pkg, memo)).join('\0');
}

/**
 * Adds where a module's bare imports are installed to its `fsModuleCache` key. vitest keys an entry by
 * the module's own content, and the transform writes each import as the path it resolved to, so a
 * cached module goes on importing the copy an earlier install had: a half-finished npm run once sent
 * `@weasel-js/font`'s `opentype.js` to the root's 1.x, and the repaired install went unread.
 */
export function resolveCacheKey(): Plugin {
  return {
    name: 'weasel:resolve-cache-key',
    configureVitest({ project, defineCacheKeyGenerator }) {
      const aliases = (project.vite.config.resolve.alias ?? []) as Alias[];
      const memo = new Map<string, string>();
      defineCacheKeyGenerator(({ id, sourceCode }) => {
        const file = id.split('?', 1)[0]!;
        if (!SOURCE.test(file) || file.includes('/node_modules/')) return undefined;
        return bareImportKey(file, sourceCode, aliases, memo);
      });
    },
  };
}
