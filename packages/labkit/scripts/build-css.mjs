#!/usr/bin/env node

// labkit ships ONE stylesheet — `dist/styles.css`, the only one a consumer
// imports — and it is these layers concatenated in this order:
//
//   0. @weasel-js/theme faces: the Oswald and Inter @font-face rules, their
//      URLs rewritten to the dist/fonts/ copies.
//   1. @weasel-js/theme tokens: the `--wzl-*` custom properties every weasel-ui
//      rule reads. Omit them and those rules paint with nothing.
//   2. @weasel-js/ui: the CSS modules behind the components labkit passes
//      through. Scoped class names are minted by ui's own build, so this comes
//      from its `dist` — the same build tsup bundles the JS out of. Take it from
//      anywhere else and the names stop matching.
//   3. windease: the structural rules its absolutely-positioned tiles depend
//      on. Workspace renders a windease zone, and without `.windease-window`
//      every tile stacks at the origin at zero size.
//   4. labkit's own `.lk-*` chrome, last, so it overrides what it wraps.
//
// A consumer installs none of those packages, so whatever is missing here is
// missing from their page with no error anywhere — which is how 1 and 2 went
// unnoticed through a release. The consumer smoke test now checks layer 2.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const packages = join(pkgRoot, '..');

// styles.less imports the theme's faces as a bare CSS @import, which a bundler
// resolves in a source build. A consumer's page may have no bundler, so the dist
// inlines them instead, pointed at the copies build:fonts puts in dist/fonts/.
const facesImport = "@import '@weasel-js/theme/faces.css';\n";
const faces = readFileSync(join(packages, 'theme/src/faces.css'), 'utf8');
const facesInDist = faces.replaceAll("url('../fonts/", "url('./fonts/");
if (facesInDist === faces) throw new Error('[css] theme faces.css no longer loads ../fonts/');

const labkit = execFileSync('lessc', [join(pkgRoot, 'src/styles.less')], { encoding: 'utf8' });
if (!labkit.includes(facesImport))
  throw new Error(`[css] lessc output has no ${facesImport.trim()}`);

const layers = [
  facesInDist,
  readFileSync(join(packages, 'theme/dist/tokens.css'), 'utf8'),
  readFileSync(join(packages, 'ui/dist/style.css'), 'utf8'),
  readFileSync(createRequire(import.meta.url).resolve('windease/styles.css'), 'utf8'),
  labkit.replace(facesImport, ''),
];

writeFileSync(join(pkgRoot, 'dist/styles.css'), layers.join('\n'));
console.log('[css] dist/styles.css — theme faces + theme tokens + weasel-ui + windease + labkit');
