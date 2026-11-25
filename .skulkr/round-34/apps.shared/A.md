# Audit round 34 — apps.shared

## The Palette lab's dev link (and the Theme editor / Theme prefs links built on it) misses the theme editor's vite base and lands on vite's 404 page
- where: apps/shared/labs.ts:14 (PALETTE_LAB), inherited by THEME_EDITOR_LAB (:19) and THEME_PREFS_LAB (:24)
- scenario: in dev, `href` is `http://localhost:33454/weasel/theme-editor` with no trailing slash, but `apps/theme-editor/vite.config.ts:23` sets `base: '/weasel/theme-editor/'`. Vite's `baseMiddleware` (node_modules/vite/dist/node/chunks/node.js:16873) passes a request on only when the pathname equals the resolved base or starts with it plus a slash. `/weasel/theme-editor` does neither, so the server answers 404 with "did you mean to visit /weasel/theme-editor/". Picking Palette lab, Theme editor or Theme prefs from any lab's title menu in dev shows that 404 page, and the `#/theme` / `#/prefs` hash never reaches the app. BADGE_LAB (:29) has the trailing slash and works. The built href `/weasel/theme-editor` also depends on the host redirecting to the slashed path.
- evidence: read
- severity: medium

## otherPrefValue returns an out-of-range number when a leaf's default is its max and it has no min
- where: apps/shared/prefsRoundTrip.ts:14 (otherPrefValue, `case 'number'`)
- scenario: take a leaf `{ kind: 'number', default: 10, max: 10 }` with no `min`. The first branch is skipped because `max === d`, the second because `min` is undefined, so it returns `d + 1 = 11`, which is above `max`. A store that clamps or rejects the value reads back 10, so `prefsRoundTrip` reports a mismatch that doesn't exist, and a draw or chart prefs test fails on a correct schema. It should return a value inside the bounds, such as `d - 1`. Similarly, an enum leaf with a single option makes `.find(...)!.value` throw a TypeError instead of the helper's own "no other value" error.
- evidence: read
- severity: low

## prefsRoundTrip leaves the first store open when flush reports failure
- where: apps/shared/prefsRoundTrip.ts:46 (prefsRoundTrip)
- scenario: when `store.flush()` resolves false, the function throws before `store.close()`, so the store `open` made is never closed. Its pending writes and any timers or listeners outlive the test that called it. The same happens if `open` or a `store.set` throws partway through the loop. The `close` calls should sit in a `finally`.
- evidence: read
- severity: low

## parsePackageRoute rejects a package address with a trailing slash
- where: apps/shared/packageRoutes.ts:33 (parsePackageRoute)
- scenario: `pkg/geom/` splits to `['geom', '']`. The `tab = 'overview'` default applies only to `undefined`, so `tab` is `''`, `isTab('')` is false, and the hash is "not a package page", even though `pkg/geom` opens the overview. A hand-typed or pasted `#pkg/geom/` (or `#pkg/geom/reference/`, which gives rest `''` but only by luck) does not open the overview. In the same way, `pkg/geom/overview/x` parses with rest `'x'`, but `packageRoute('geom', 'overview', 'x')` drops `rest`, so the two directions of the grammar disagree.
- evidence: read
- severity: low

## The Releases fallback counts Internal entries toward FALLBACK_MIN_ENTRIES but never shows them
- where: apps/shared/releases.ts:112 (summarize)
- scenario: take a release with 8 entries, 7 of them tagged `internal` and 1 `fix`. `entries.length < FALLBACK_MIN_ENTRIES` is false, so it falls back to highlights and shows the single fix as the release's highlight, although by the rule's own reasoning ("a short release is its own summary") the release has only one entry a reader sees. A 7-entry release with 7 user-facing changes shows none. The threshold and the candidate list should be counted over the same set (non-Internal entries).
- evidence: read
- severity: low

## Files read
apps/shared/buildInfo.ts
apps/shared/defaultFont.ts
apps/shared/hashRoute.ts
apps/shared/labs.ts
apps/shared/markdown.ts
apps/shared/packageDocs.ts
apps/shared/packageRoutes.ts
apps/shared/prefsRoundTrip.ts
apps/shared/reference.ts
apps/shared/releases.ts

<!-- done: 5 findings, files read: 10 -->
