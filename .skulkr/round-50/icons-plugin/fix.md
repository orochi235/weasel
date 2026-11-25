`icon` used as a value, not a direct call (A, B): fixed 9e1d1738b6. Uses like `list.map(icon)`, `const f = icon` and tagged templates now warn. `icon!('x')` and `(icon)('x')` are rewritten as calls. I recorded this as my call in `docs/unruled.md` (8f74afe0f5): it warns rather than failing the build.
`var` in a class `static {}` block doesn't shadow the import (A, B): fixed 06b163be0f
Declarations in a TS `namespace` body don't shadow the import (A, B): fixed 06b163be0f. Exported declarations in the namespace body now shadow too.
Dev `virtual:weasel-icons` never invalidated (A): fixed b8dd7f4a3d. A table a transform finds, or a change to an `icons.table.json`, reloads every loaded variant. A glyph a regenerated table drops stays until a restart; that is my call, in `docs/unruled.md`.
`assertBundler` looks the mode up through the prototype chain (A): fixed 4930af788a
`vite build --mode test` runs the dev path (B): fixed 82051124e6. Vitest still gets the dev path through `command: 'serve'`; apps/draw `iconCoverage.test.tsx` passes.
`icon()` in Vue/Svelte/Astro script blocks skipped without a warning (B): fixed 4669821d0a. A second plugin, ordered `post`, reads any module another plugin compiles to JS. `weaselIcons.vite()`, `.rollup()` and `.rolldown()` now return an array of two plugins. Its changeset is marked `major` / `breaking`, because code that reads the result as a single plugin has to change. Your call whether that stands.
`collectIconRefs` fallback drops template literals and returns escapes as raw text (B): fixed c2c2233e7b

Extra:
Raw `2px` in SpanStrip's label `font-size` failed labkit's design-token check (sweep, outside this area): fixed c9d03f0aae. Font size and line height now come from one custom property, with no visual change and no changeset.
Raw `tabular-nums` in the audits Treemap's `.upcomingCount` failed `check:numeric` (sweep, outside this area): fixed e36152bf2e. It now uses the theme's `numeric` class.

Checks:
- `npx vitest run --maxWorkers=1 packages/icons-plugin/src/rewrite.test.ts`: pass (31)
- `npx vitest run --maxWorkers=1 packages/icons-plugin/src/bundlers.test.ts`: pass (4)
- `npx vitest run --maxWorkers=1 packages/icons-plugin/src/collect.test.ts`: pass (3)
- `npx vitest run --maxWorkers=1 packages/icons-plugin/src/plugin.build.test.ts`: pass (16)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/SpanStrip/SpanStrip.test.tsx`: pass (15)
- `npx vitest run --maxWorkers=1 packages/icons-plugin`: pass (14 files, 83 tests)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run check:changesets`: pass
- `npm run typecheck:packages -- icons-plugin`: pass
- `npm run lint -w @weasel-js/labkit`: pass
- `npm run lint` (root eslint): pass
- `npm run lint -w @weasel-js/icons-plugin` / `-w @weasel-js/ui`: those packages have no lint script, so the root lint above covers them.

tally: 10 of 10 fixed, 2 extra fixed