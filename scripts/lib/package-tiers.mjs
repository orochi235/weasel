/**
 * Each @weasel-js package's tier, from `weasel.tier` in its manifest, held to the dependency graph.
 *
 * - `core` is @weasel-js/core alone.
 * - `base` is a package core depends on, directly or not. The graph decides it; the manifest repeats
 *   it so that core taking on a new dependency is a change someone sees.
 * - `plugin` is high-level functionality dropped into a canvas built on core.
 * - `other` is the rest: hosts, apps, file formats, tooling. One that doesn't reach core at all is
 *   drawn as standalone, which is a fact about the graph and not declared.
 */
import { publishableWorkspaces } from './workspaces.mjs';

export const TIERS = ['base', 'core', 'plugin', 'other'];
export const SCOPE = '@weasel-js/';

/** Every publishable package by short name: its directory, declared tier and @weasel-js dependencies. */
export function readPackages(root) {
  const out = new Map();
  for (const { dir, manifest } of publishableWorkspaces(root)) {
    if (!manifest.name.startsWith(SCOPE)) continue;
    const deps = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })
      .filter((k) => k.startsWith(SCOPE)).map((k) => k.slice(SCOPE.length));
    out.set(manifest.name.slice(SCOPE.length), { dir, tier: manifest.weasel?.tier, deps });
  }
  return out;
}

/** What `name` depends on, directly or not. */
export function closureOf(packages) {
  const memo = new Map();
  return (name) => {
    if (memo.has(name)) return memo.get(name);
    const seen = new Set(), stack = [...(packages.get(name)?.deps ?? [])];
    while (stack.length) {
      const x = stack.pop();
      if (!seen.has(x)) { seen.add(x); stack.push(...(packages.get(x)?.deps ?? [])); }
    }
    memo.set(name, seen);
    return seen;
  };
}

/** Each way the declared tiers disagree with the graph, as a sentence naming the fix. */
export function tierProblems(packages) {
  const closure = closureOf(packages);
  const base = closure('core');
  const problems = [];
  for (const [name, { tier }] of packages) {
    const where = `packages/${name}/package.json`;
    if (!TIERS.includes(tier)) {
      problems.push(`${where} has ${tier === undefined ? 'no "weasel.tier"' : `"weasel.tier": "${tier}"`}; ` +
        `set it to one of ${TIERS.join(', ')}.`);
    } else if ((tier === 'core') !== (name === 'core')) {
      problems.push(`${where} says "${tier}", but only @weasel-js/core is "core".`);
    } else if (tier === 'base' && !base.has(name)) {
      problems.push(`${where} says "base", but core no longer depends on it; it is "plugin" or "other".`);
    } else if (base.has(name) && tier !== 'base') {
      problems.push(`${where} says "${tier}", but core depends on it, which makes it "base".`);
    } else if (tier === 'plugin' && !closure(name).has('core')) {
      problems.push(`${where} says "plugin", but it doesn't depend on core, so it has no canvas to drop into.`);
    }
  }
  return problems;
}
