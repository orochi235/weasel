import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { Plugin } from 'vite';

interface Alias {
  find: string | RegExp;
  replacement: string;
}

const COMMENT = /\/\*[\s\S]*?\*\//g;
const IMPORT = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g;
const COMPOSES = /composes\s*:[^;}]*?\bfrom\s+['"]([^'"]+)['"]/g;

/** Every sheet `css` reads by `@import` or `composes … from`, as written. */
export function cssDependencySpecifiers(css: string): string[] {
  const source = css.replace(COMMENT, '');
  return [...source.matchAll(IMPORT), ...source.matchAll(COMPOSES)].map((m) => m[1]);
}

function resolveSheet(specifier: string, importer: string, aliases: readonly Alias[]): string | null {
  if (/^[a-z]+:/i.test(specifier)) return null;
  if (specifier.startsWith('.')) return resolve(dirname(importer), specifier);
  if (isAbsolute(specifier)) return specifier;
  for (const { find, replacement } of aliases) {
    if (typeof find === 'string') {
      if (specifier === find) return replacement;
      if (specifier.startsWith(`${find}/`)) return replacement + specifier.slice(find.length);
    } else if (find.test(specifier)) {
      return specifier.replace(find, replacement);
    }
  }
  try {
    return createRequire(importer).resolve(specifier);
  } catch {
    return null;
  }
}

/**
 * The content of every sheet `file` reaches through `@import` and `composes … from`, transitively,
 * as one string: changing any of them changes it. `file`'s own content is not in it.
 */
export function cssDependencyKey(file: string, aliases: readonly Alias[] = []): string {
  const seen = new Set([file]);
  const parts: string[] = [];
  const visit = (sheet: string, css: string) => {
    for (const specifier of cssDependencySpecifiers(css)) {
      const target = resolveSheet(specifier, sheet, aliases);
      if (target == null) {
        parts.push(`?${specifier}`);
        continue;
      }
      if (seen.has(target)) continue;
      seen.add(target);
      let content: string;
      try {
        content = readFileSync(target, 'utf8');
      } catch {
        parts.push(`!${target}`);
        continue;
      }
      parts.push(`${target}\0${content}`);
      visit(target, content);
    }
  };
  visit(file, safeRead(file));
  return parts.join('\0');
}

function safeRead(file: string): string {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Adds the sheets a CSS file imports to its `fsModuleCache` key. vitest keys an entry by the module's
 * own content, so without this an edit to an `@import`ed sheet alone leaves the importer's cached
 * class map in place, and a new class reads `undefined`.
 */
export function cssCacheKey(): Plugin {
  return {
    name: 'weasel:css-cache-key',
    configureVitest({ project, defineCacheKeyGenerator }) {
      const aliases = (project.vite.config.resolve.alias ?? []) as Alias[];
      defineCacheKeyGenerator(({ id }) => {
        const file = id.split('?', 1)[0];
        if (!file.endsWith('.css')) return undefined;
        return cssDependencyKey(file, aliases);
      });
    },
  };
}
