/**
 * Dev/build Vite plugin that parses `packages/theme/src/tokens.css`
 * and exposes the parsed list of `--wzl-*` design tokens via the virtual
 * module
 *
 *   import tokens from 'virtual:weasel-tokens';
 *
 * Consumed by the CSS Vars Storybook addon to populate its Theme tab.
 *
 * Mirrors the `vite-plugin-trait-schemas.ts` pattern: lazy parse on first
 * `load()`, cached, and (in `serve` mode) invalidated when `tokens.css`
 * changes so the addon panel hot-reloads.
 */
import type { Plugin, ViteDevServer } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VIRTUAL_ID = 'virtual:weasel-tokens';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

export interface Token {
  readonly name: string;
  readonly defaultValue: string;
  readonly group: string;
}

export interface WeaselTokensPluginOptions {
  /** Absolute path to the repo root (passed in from the Vite config). */
  readonly repoRoot: string;
}

/**
 * Parse `--wzl-*: value;` declarations out of a CSS source string.
 *
 * Handles multi-line values (e.g. font stacks, `color-mix(...)` calls).
 * Strips comments first so commented-out tokens are skipped. The regex
 * matches `--wzl-<name>: <value>;` non-greedily across newlines.
 */
function parseTokens(css: string): Token[] {
  // Strip /* ... */ block comments first.
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Extract only the `:root { ... }` block contents. Theme-scoped
  // overrides like `[data-theme='light'] { --wzl-fg: ... }` would
  // otherwise clobber the canonical defaults.
  const rootBodies: string[] = [];
  // `:root` must not be preceded by an identifier char (so we don't match
  // `[data-theme=':root']` etc.). Body is everything up to the next `}`.
  const rootRe = /(?<![\w-]):root\s*\{([^}]*)\}/g;
  let rm: RegExpExecArray | null;
  while ((rm = rootRe.exec(noComments)) !== null) rootBodies.push(rm[1]);
  const source = rootBodies.length > 0 ? rootBodies.join('\n') : noComments;

  const out: Token[] = [];
  const seen = new Set<string>();
  // Non-greedy value capture; terminator is `;`. tokens.css declarations
  // don't embed `;` inside values, so the naive form is fine.
  const re = /(--wzl-[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const value = m[2].trim().replace(/\s+/g, ' ');
    // Within :root, last-wins matches CSS cascade. Keep first-occurrence
    // ordering for stable UI.
    if (seen.has(name)) {
      const idx = out.findIndex((t) => t.name === name);
      if (idx >= 0) out[idx] = { ...out[idx], defaultValue: value };
      continue;
    }
    seen.add(name);
    out.push({ name, defaultValue: value, group: groupOf(name) });
  }
  return out;
}

/**
 * Group key for a token. `--wzl-fg-muted` → `fg`, `--wzl-surface-raised`
 * → `surface`, `--wzl-accent` → `accent`. Splits on the first hyphen
 * after the `--wzl-` prefix; single-segment names use themselves as the
 * group so they still land in a bucket.
 */
function groupOf(name: string): string {
  const tail = name.replace(/^--wzl-/, '');
  const dash = tail.indexOf('-');
  if (dash === -1) return tail;
  return tail.slice(0, dash);
}

export function weaselTokensPlugin(opts: WeaselTokensPluginOptions): Plugin {
  const tokensPath = resolve(opts.repoRoot, 'packages/theme/src/tokens.css');
  let cached: Token[] | null = null;
  let server: ViteDevServer | null = null;

  const compute = (): Token[] => {
    if (!cached) {
      const css = readFileSync(tokensPath, 'utf8');
      cached = parseTokens(css);
    }
    return cached;
  };

  return {
    name: 'weasel:tokens',
    configureServer(s) {
      server = s;
      s.watcher.add(tokensPath);
      s.watcher.on('change', (file) => {
        if (resolve(file) !== tokensPath) return;
        cached = null;
        const mod = server?.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod && server) server.moduleGraph.invalidateModule(mod);
        server?.ws.send({ type: 'full-reload' });
      });
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const tokens = compute();
      return `export default ${JSON.stringify(tokens)};\n`;
    },
  };
}
