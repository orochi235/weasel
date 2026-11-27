#!/usr/bin/env node
// Fails when a package's `weasel.tier` is missing or disagrees with the dependency graph.
// The rules are in scripts/lib/package-tiers.mjs; `npm run graph:packages` draws the result.
import { cli } from './lib/help.mjs';
import { readPackages, tierProblems } from './lib/package-tiers.mjs';

cli(import.meta.url, {
  summary: "Fails when a package's `weasel.tier` is missing or disagrees with the dependency graph.",
  notes: '`npm run graph:packages` draws the result.',
});

const problems = tierProblems(readPackages());
for (const p of problems) console.error(`[package-tiers] ${p}`);
if (problems.length) process.exit(1);
console.log('[package-tiers] OK — every package declares a tier the graph agrees with.');
