## A release whose entries chunk fails to load shows "Loading…" forever and bypasses the stale-chunk reload
- where: apps/site/ReleaseSection.tsx:28 (useEntries)
- scenario: a tab opened before a deploy opens a release section (or the lead one opens on mount); `release.load()` is a dynamic `import()` of a per-release chunk (scripts/release/vite-plugin.ts:40) whose hashed name no longer exists. The promise rejects, `.then` has no rejection handler, so the rejection is unhandled, `entries` stays null and the section reads "Loading…" indefinitely. The rejection never reaches `PageBoundary`, so the site's one-reload policy for missing chunks (`isChunkLoadError` + `reloadOnce`) never runs and no error or retry is offered. The demo source panel handles the same failure (`useSourceText` → 'failed' with a message); releases should too (show a failure, or rethrow into the boundary).
- evidence: read
- severity: medium

## Five published packages have no release-chip badge, beyond the two the TODO already tracks
- where: apps/site/releaseIcons.ts:6 (PACKAGE_ICONS)
- scenario: `@weasel-js/text-tools`, `@weasel-js/ui-canvas`, `@weasel-js/scale`, `@weasel-js/prefs-schema` and `@weasel-js/paint-kinds` are published (non-private manifests) but have no `PACKAGE_ICONS` key, so `chipIcon(PACKAGE_ICONS[name])` gives their Releases filter and entry chips no leading icon. `chipIcon`'s contract (ReleaseChipIcon.tsx:4) reserves an icon-less chip for "a package the history names but no longer ships"; these ship (text-tools and ui-canvas even have demos filed under them in registry.ts). docs/TODO.md:464 covers only `prefs-editor` and `export`.
- evidence: read
- severity: low

## "Demo updates" sorts by raw ISO strings carrying per-commit UTC offsets, so close dates can sort out of order
- where: apps/site/WhatsNew.tsx:21 (BY_LAST_MODIFIED / created, lastModified columns)
- scenario: timestamps come from `git log --format=%aI` (scripts/vite-demo-timestamps.ts:73), the author's local offset. The columns have no `accessor`, so DataGrid sorts the strings lexicographically: `2026-11-16T21:00:00-08:00` (05:00Z on the 17th) sorts older than `2026-11-17T01:00:00+00:00`, though it is newer. Commits made across a DST change or by authors in different zones misorder "Newest change first", and the displayed `isoDay` (UTC) can disagree with the row order. An accessor of `Date.parse(d.lastModified)` would sort by instant.
- evidence: read
- severity: low

