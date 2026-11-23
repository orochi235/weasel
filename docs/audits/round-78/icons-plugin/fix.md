- Compiled (non-source) module keeps stale refs through watch rebuilds (A): fixed 86190f4893
- Built `dist` table overrides the source table in a build and in dev (A): fixed 1f3867c2bb
- Namespace `all` can't be loaded as `virtual:weasel-icons/<namespace>`, and nothing says so (A): fixed 65cbc5bb0a. This was a strict call: a table whose namespace is `all` or empty now fails the build. Recorded in `docs/unruled.md`.
- Extensionless `./icons.gen` isn't followed to `.tsx`, `.jsx`, `.mts` or `.mjs` (A): fixed 90cc1771f4. `.cts` and `.cjs` are covered too.
- `icon` in TS type, enum-member and bodiless-signature positions warns, and `import icon =` doesn't shadow (A): fixed 3fce1518cf
- Dev table watcher throws out of the chokidar listener (A): fixed 76d3a8a4e7
- Built `dist` table overrides the source table (B): duplicate of A's built-over-source finding
- esbuild library mode with minify ships unannotated refs silently (B): fixed fe20d50a96, docs 76b810949f. This was a strict call: a build that minifies whitespace now fails, while `minify: true` with `minifyWhitespace: false` still builds. Recorded in `docs/unruled.md`.
- `declaredTable`'s unbuilt fallback takes only the first source table (B): fixed 527254b4e0
- `icon` in type positions outside `TSTypeAnnotation` counts as a non-call use (B): duplicate of A's type-position finding
- JSX element naming the imported `icon` is neither rewritten nor warned about (B): fixed 0dda3c6dd3
- `watchTables` reads the directory outside its `try` (B): duplicate of A's watcher finding

Extra commits:
- b30603e9d6 shortens six of my changeset titles to under 140 characters.
- 227516937b moves the compiled-module plugin out of the plugin factory, which had grown past `check:size`'s 120-line cap for a function.

Neither is a defect fix, so X is 0.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `plugin.build.test.ts`: pass (19)
  - `tables.test.ts`: pass (11)
  - `catalog.test.ts`: pass (2)
  - `rewrite.test.ts`: pass (34)
  - `catalog.pbt.test.ts`: pass (2)
  - `rewrite.pbt.test.ts`: pass (3)
  - `library.build.test.ts`: pass (4)
  - `bundlers.test.ts`: pass (4)
- `npm run checks:gate`: the first run failed with "checks:gate: 1 of 33 failed" (`check:size`). After 227516937b: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/icons-plugin`: there is no such script, because the package has no `lint`. Instead `npx eslint packages/icons-plugin/src`: pass. The root `npm run lint` passed inside the gate.
- `npm run check:changesets`: pass, with no warnings on the icons-plugin changesets.
- Tree is clean.

tally: 9 of 12 fixed, 0 extra fixed