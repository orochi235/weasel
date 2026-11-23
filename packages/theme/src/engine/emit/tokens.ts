import { enumerateAxisChoices } from '../../axes.ts';
import type { ThemeDefinition } from '../../definition.ts';
import { bake } from '../bake.ts';
import { axisDependencies } from '../deps.ts';
import { derive } from '../derive.ts';
import { mergeChain } from '../merge.ts';
import { emitCss } from './css.ts';
import { emitManifest } from './manifest.ts';
import { emitThemes, missingTokens } from './themes.ts';

/** The files {@link generateTokens} produces, or every problem that stopped it. */
export type GeneratedTokens =
  | { readonly ok: true; readonly files: { readonly 'tokens.css': string; readonly 'themes.ts': string; readonly 'manifest.ts': string } }
  | { readonly ok: false; readonly problems: readonly string[] };

/** Every generated token file for a set of definitions, the one that extends nothing being the default. Any derive issue refuses the whole set, as do two definitions of one name and a token one theme or selection has and another lacks. */
export function generateTokens(definitions: readonly ThemeDefinition[]): GeneratedTokens {
  const counts = new Map<string, number>();
  for (const d of definitions) counts.set(d.name, (counts.get(d.name) ?? 0) + 1);
  const repeated = [...counts].filter(([, n]) => n > 1).map(([name, n]) => `${n} themes are named ${JSON.stringify(name)}; each theme needs a name of its own`);
  if (repeated.length > 0) return { ok: false, problems: repeated };
  const byName = new Map(definitions.map((d) => [d.name, d]));
  const lookup = (name: string) => byName.get(name);

  const roots = definitions.filter((d) => !d.extends);
  if (roots.length !== 1) throw new Error(`themes/ needs exactly one theme that extends nothing; found ${roots.length}`);
  const ordered = [roots[0], ...definitions.filter((d) => d.extends)];

  const problems = ordered.flatMap((def) => {
    const selections = enumerateAxisChoices(mergeChain(def, lookup).axes ?? {});
    // An axis with no values leaves nothing to enumerate; one derive still reports the axis.
    return (selections.length > 0 ? selections : [{}]).flatMap((sel) =>
      derive(def, sel, lookup).issues.map((issue) => `${def.name} ${JSON.stringify(sel)}: ${JSON.stringify(issue)}`),
    );
  });
  if (problems.length > 0) return { ok: false, problems };

  const themes = ordered.map((definition) => ({
    definition,
    baked: bake(definition, lookup),
    deps: axisDependencies(definition, lookup),
    isDefault: definition === roots[0],
  }));
  const gaps = missingTokens(themes);
  if (gaps.length > 0) return { ok: false, problems: gaps };
  return {
    ok: true,
    files: { 'tokens.css': emitCss(themes), 'themes.ts': emitThemes(themes), 'manifest.ts': emitManifest(themes[0]) },
  };
}
