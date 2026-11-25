- Resolution widget passes the first registry id alphabetically as the active tool, and the signature never notices a tool change (A): fixed 327b454b3d
- Resolution widget's `key` gesture sends an empty key, so it never matches a binding (A): fixed b85b309a97
- Source lookup globs the wrong directories, so no kit symbol resolves and draw's links point at `<root>/src/…` (A): fixed 0275f8e2ab. Globbing the packages directly would have put about 20 MB of source in the inspector's chunk. Instead, a new Vite plugin serves `virtual:weasel-source-index`, which holds where each export is declared: path, line and JSDoc (about 3.4 MB). It is wired into `apps/draw/vite.config.ts` and into `vitest.config.ts`, in the draw and forge-stories projects. Because it touches `vitest.config.ts`, this commit falls under the fleet triggers, so the batch gets a full run.
- Properties trait never lists `text`, because the probe reports core's defaults (A): fixed 15364d8835
- Draw glyphs that an action also draws are listed twice under one id (A): fixed c0005775dd
- The inspector's selected entry is a stale object that never updates when the probe's snapshot arrives (A): fixed 47c2f63f90
- A shape kind's op-factory links navigate to `opFactory`, which no tree category holds (A): fixed c3e8f5ced8. They now open the matching Ops entries (insert, delete, transform, reparent).
- A deep link that hasn't resolved yet overrides the user's later pick (A): fixed 13bdeab605
- Gesture pages and counts ignore 7 of the 16 catalogued gesture kinds (A): fixed beebcfdcbf. Removed the dead `GESTURE_CHANNEL_KEYS` along the way.

Reviewer B's report (`B.md`) was empty, so every finding above is A's alone. I wrote no changesets: `apps/draw` has no `package.json` and publishes nothing, and no earlier changeset covers draw's dev pages. I recorded nothing in `docs/unruled.md`, since none of these needed a behavior call.

Extra defects found while fixing: none.

Checks (each test file run on its own with `--maxWorkers=1`):
- `apps/draw/src/dev/toolkit/ResolutionWidget.test.tsx`: pass (7)
- `apps/draw/src/dev/toolkit/useToolReflection.test.ts`: pass (2)
- `apps/draw/src/dev/ToolkitBuilder.test.tsx`: pass (5)
- `apps/draw/src/dev/resolutionInput.test.ts`: pass (12)
- `apps/draw/vite-plugin-source-index/exportInfo.test.ts`: pass (6)
- `apps/draw/vite-plugin-source-index.test.ts`: pass (3)
- `apps/draw/src/dev/sourceLookup.test.ts`: pass (2)
- `apps/draw/src/dev/registryProbe.test.tsx`: pass (7)
- `apps/draw/src/dev/registryData.test.tsx`: pass (17)
- `apps/draw/src/dev/RegistryInspector.selection.test.tsx`: pass (3)
- `apps/draw/src/dev/RegistryInspector.test.tsx`: pass (4)
- `apps/draw/src/dev/RegistryDetail.test.tsx`: pass (16)
- `scripts/lib/fleet-triggers.test.ts`: pass (2)
- Unrun (browser tests): `apps/draw/src/dev/toolkit/ResolutionWidget.browser.test.tsx`, `apps/draw/src/dev/ToolkitBuilder.browser.test.tsx`
- `npm run typecheck`: pass, no errors. `typecheck:packages` doesn't apply, since no package changed.
- eslint on the changed files: pass, 0 errors and 1 warning (`virtual-source-index.d.ts` is ignored by a matching ignore pattern)
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass ("[changesets] OK — 1354 changeset(s).")
- `npm run check:test-projects`: pass ("all 5271 vitest files are collected by `npm test`.")
- Tree clean: every change is committed.