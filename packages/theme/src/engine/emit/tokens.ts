import { enumerateSelections } from '../../axes';
import type { ThemeDefinition } from '../../definition';
import { bake } from '../bake';
import { axisDependencies } from '../deps';
import { derive } from '../derive';
import { mergeChain } from '../merge';
import { emitCss } from './css';
import { emitManifest } from './manifest';
import { emitThemes } from './themes';

export type GeneratedTokens =
  | { readonly ok: true; readonly files: { readonly 'tokens.css': string; readonly 'themes.ts': string; readonly 'manifest.ts': string } }
  | { readonly ok: false; readonly problems: readonly string[] };

/** Every generated token file for a set of definitions, the one that extends nothing being the default. Any derive issue refuses the whole set. */
export function generateTokens(definitions: readonly ThemeDefinition[]): GeneratedTokens {
  const byName = new Map(definitions.map((d) => [d.name, d]));
  const lookup = (name: string) => byName.get(name);

  const roots = definitions.filter((d) => !d.extends);
  if (roots.length !== 1) throw new Error(`themes/ needs exactly one theme that extends nothing; found ${roots.length}`);
  const ordered = [roots[0], ...definitions.filter((d) => d.extends)];

  const problems = ordered.flatMap((def) =>
    enumerateSelections(mergeChain(def, lookup).axes ?? {}).flatMap((sel) =>
      derive(def, sel, lookup).issues.map((issue) => `${def.name} ${JSON.stringify(sel)}: ${JSON.stringify(issue)}`),
    ),
  );
  if (problems.length > 0) return { ok: false, problems };

  const themes = ordered.map((definition) => ({
    definition,
    baked: bake(definition, lookup),
    deps: axisDependencies(definition, lookup),
    isDefault: definition === roots[0],
  }));
  return {
    ok: true,
    files: { 'tokens.css': emitCss(themes), 'themes.ts': emitThemes(themes), 'manifest.ts': emitManifest(themes[0]) },
  };
}
