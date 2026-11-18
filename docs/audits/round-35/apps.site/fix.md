- Release with a failed entry load shows "Loading…" forever and skips the stale-chunk reload (A+B): fixed 1729c09236
- Five or seven published packages have no release-chip badge (A+B): question (the badges need the maintainer's sketch first, as `docs/TODO.md` already said for two of them). In 9dfb01f8bd I widened that TODO entry to all seven: `export`, `paint-kinds`, `prefs-editor`, `prefs-schema`, `scale`, `text-tools`, `ui-canvas`. I added `releaseIcons.test.ts`, which holds that list and fails when a new published package has no badge. No glyphs drawn.
- "Demo updates" sorts by date strings carrying each author's UTC offset (A): fixed 6b3c00c8c7. The existing `WhatsNew.test.tsx` also compared strings to find the newest date; it now compares instants.
- Releases deep link scrolls to and reopens its version again when a filter change remounts the section (B): fixed 449f915235
- Releases filter and `?v=` stay in the URL after leaving Releases and come back on the next visit (B): fixed 42440a331d. Only `pkg`, `tag` and `v` are dropped. The rest of the query, such as the site-wide `?backend=`, is kept, and the history entry Releases was shown in keeps its params, so Back still returns to the filtered view.
- Sidebar wordmark replaces the current history entry instead of pushing one (B): fixed 401c653fee. `goFront` now takes `'push' | 'replace'`; a hash that named nothing still replaces.
- In light mode the active site-page link is near-white text on a pale tint (B): fixed 1d3aa0c56d. The test for it is in `siteStyles.browser.test.ts`, which is unrun because it is a browser test.
- Narrow viewport: a new page doesn't start at its top (B): fixed 8d211e6ac8
- `.ckd-demo`'s gap declared twice with different values (B): fixed 5acd45a66f. The two rules are now one, keeping the value that was winning (`var(--wzl-space-4)`). `stylesheets.test.ts` fails on any property a site stylesheet declares twice for one selector. This was the only case in `apps/site/*.css`.
- `loupe-model` description names a demo by a title that doesn't exist (B): fixed f195b1c189. A `registry.test.ts` case checks every "Stem (qualifier)" demo name in descriptions and hints against the real titles; this was the only bad one.

No extra defects found. No changesets: every change is in `apps/site`, which is not a published package, and `check:changesets` passes.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time, all pass: `ReleaseSection.test.tsx` (2), `Releases.test.tsx` (16), `Releases.mount.test.tsx` (5), `Releases.tags.test.tsx` (8), `Releases.chips.test.tsx` (1), `Releases.count.test.tsx` (1), `WeaselDemos.routing.test.tsx` (19), `WhatsNew.order.test.tsx` (1), `WhatsNew.test.tsx` (3), `registry.test.ts` (14), `releaseIcons.test.ts` (1), `stylesheets.test.ts` (1)
- `apps/site/siteStyles.browser.test.ts`: unrun (browser test)
- `npm run typecheck` (no package changed, so `typecheck:packages` doesn't apply; the root program covers `apps/site`): pass
- eslint on every changed `.ts`/`.tsx` file: pass
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass ("[changesets] OK — 1676 changeset(s).")
- `check:spacing`, `check:on-accent`, `check:token-reads`, `check:test-projects`: pass
- Tree clean apart from `.skulk/`