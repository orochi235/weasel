# apps.forge findings (round 70)

## followScheme subscribes to the OS scheme at module load and never unsubscribes, so each re-evaluation of the frame config leaves a live listener re-applying stale globals
- where: apps/forge/mode.ts:22 (followScheme), called at module scope from apps/forge/forge.frame.tsx:26
- scenario: in the dev workshop, edit forge.frame.tsx, fonts.ts or themes.ts so Vite HMR re-evaluates the frame config. The old `followScheme` closure is still registered through `watchColorScheme` and still holds its `last` map of roots with the globals they had then. A root that stays connected across the reload (a story host that is kept, not remounted) is re-themed by the old closure with the old globals and the old `apply` (old fontRule/applyTrialTheme) on the next OS light/dark switch. Whether the old or new apply lands last depends on listener order. Each reload adds another listener and keeps another closure and map alive. The unsubscribe that `watchColorScheme` returns should be released, for example on `import.meta.hot.dispose`, or the subscription should be held once per page.
- evidence: read
- severity: low

## csf.mjs waits on the last settled host but checks the last host, which can be a different element
- where: apps/forge/e2e/csf.mjs:22-23
- scenario: `frame` is `.fg-story[data-fg-host]` `.last()`, but the wait is on `.fg-story[data-fg-host]:not([data-pending])` `.last()`. When the page holds more than one host (a trial restored alongside the hash's one, or a story that opens a second host) and the earlier one has painted while the hash's story is still `data-pending`, the wait resolves at once on the earlier host. The check then runs against a host whose story has not painted yet, and fails spuriously or reads the wrong state. The wait should be on the same element as `frame`, for example `frame.and(page.locator(':not([data-pending])'))` or waiting for `frame` to lose `data-pending`.
- evidence: read (whether a fresh context can ever open more than one host on load is inferred, not run)
- severity: low

## Files read
apps/forge/DevtoolsDock.tsx
apps/forge/a11y.known.ts
apps/forge/a11y.shards.ts
apps/forge/a11y.suite.tsx
apps/forge/devtools.module.css
apps/forge/devtools.tsx
apps/forge/e2e/csf.mjs
apps/forge/e2e/smoke.mjs
apps/forge/e2e/stories.d.mts
apps/forge/e2e/stories.mjs
apps/forge/fonts.ts
apps/forge/forge.frame.tsx
apps/forge/forge.shell.tsx
apps/forge/frame.css
apps/forge/icons.gen.ts
apps/forge/icons/index.mjs
apps/forge/libraries.css
apps/forge/libraries.ts
apps/forge/mode.ts
apps/forge/themes.ts
apps/forge/vite.config.ts
apps/forge/viteShared.ts

<!-- done: 2 findings, files read: 22 -->
