# Audit round 34: apps.shared

## The dev-mode Palette lab, Theme editor and Theme prefs links 404 on the theme-editor dev server
- where: apps/shared/labs.ts:14 (PALETTE_LAB; THEME_EDITOR_LAB:19 and THEME_PREFS_LAB:24 build on it)
- scenario: in dev, a lab's title menu links to `http://localhost:33454/weasel/theme-editor`, with no trailing slash. `apps/theme-editor/vite.config.ts` sets `base: '/weasel/theme-editor/'`. Vite's `baseMiddleware` (node_modules/vite/dist/node/chunks/node.js:16868) passes a request only when `pathname === base` or the pathname starts with `base`, so `/weasel/theme-editor` fails both tests. It isn't `/` either, so Vite doesn't redirect it; it returns a 404 page that says "did you mean to visit …". The `#/theme` and `#/prefs` fragments are lost on that page, so all three theme-editor entries in `LABS` are dead links in dev. BADGE_LAB on the next lines gets this right with `/weasel/ui-lab/`. The fix is to end the href with `/weasel/theme-editor/` in dev (and in prod, to match the base).
- evidence: read
- severity: medium

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

<!-- done: 1 findings, files read: 10 -->
