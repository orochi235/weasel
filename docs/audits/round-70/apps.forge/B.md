# Audit round 70 — apps.forge

## labkit stories drop the Theme and Density globals: LabRoot re-themes them as interstellar
- where: apps/forge/forge.frame.tsx:23 (labkitRoot)
- scenario: Theme = win9x (or weasel/platinum) and Density = compact, open any `labkit/…` story. `applyTrialTheme` themes the host root through the DOM (`applyTheme`), but no React theme context sits above the story (packages/forge/src has no ThemeProvider outside CaptureView). So `LabRoot`'s `useThemeOptional()` returns null and it wraps the story in `<ThemeProvider theme={interstellarTheme} selection={{ mode }}>` (packages/labkit/src/lab/LabRoot.tsx:40-46). That wrapper re-declares every token as interstellar at the default density, so the story shows interstellar whatever Theme says, and Density never reaches it. Only mode is passed through. Expected: the trial's chosen theme and density reach labkit stories the way they reach ui stories.
- evidence: read
- severity: medium

## The a11y sweep titles stories from their directory, not the title the workshop gives them
- where: apps/forge/a11y.suite.tsx:39 (titleOf), used at :147-151
- scenario: `packages/labkit/src/primitives/JobProgress.stories.tsx` declares `title: 'labkit/Primitives/JobProgress'`, and the workshop indexes it under that title (story id `labkit-primitives-jobprogress--…`). The sweep passes `'labkit/primitives'` to `loadStories` and `runStory`, and `loadCsfModule` uses the passed title as given (storyId(title, exportName), packages/forge/src/csf/loadCsfModule.tsx:206). Every story file in one directory gets the same title: about 17 files under `ui/components/Prefs` and `Properties` share one, so their story ids collide. Anything a story or decorator keys on `ctx.title` or the id (trial names, persisted trial records, landmark names) differs from what the workshop renders, which contradicts the file's claim to render "as the workshop renders it". Expected: the title the story index computes (meta.title, or the autotitle).
- evidence: read
- severity: low

## The focus-ring sweep passes a Tab stop it took no unfocused snapshot of
- where: apps/forge/a11y.suite.tsx:93,116-117 (unringed)
- scenario: `before` is filled only from `host.querySelectorAll(FOCUSABLE)` before tabbing starts. An element Tab reaches that FOCUSABLE does not match is skipped as though it drew a ring (`was === undefined → continue`). That covers an `iframe`, `audio`/`video[controls]`, `[contenteditable=""]` or `plaintext-only`, and an element mounted after the snapshot (a popover opened on focus, a lazily rendered row). Its screenshot comparison never runs, so a ringless stop passes. Expected: take the unfocused look of any reached element that `before` lacks (for example by the same focus-elsewhere screenshot path), rather than skipping it.
- evidence: read
- severity: low

## The Weight global defaults to a weight the default font hides
- where: apps/forge/fonts.ts:85-89 (FONT_GLOBALS.fontWeight)
- scenario: the Font global defaults to `oswald`, which ships weights 200/300/400, but Weight defaults to `'500'`. Its `shows` filter hides the 500 option under Oswald. With no change from the user, the toolbar holds a value its own option list doesn't show, while `fontRule` quietly snaps it to 400. Expected: a default the default font ships (400), or shown options that include the current value.
- evidence: read
- severity: low

## The animation waits hang on a paused finite animation
- where: apps/forge/a11y.suite.tsx:45-50 (settled), :111-115 (unringed)
- scenario: both waits filter only on `endTime !== Infinity` and then await `a.finished`. A finite animation whose playState is `paused` (for example `animation-play-state: paused` held by a story, or an animation a component pauses until hover) never finishes. The file's test then waits until its 120 s timeout and reports a timeout, not a verdict. Expected: skip animations that aren't running (`playState !== 'running'`), just as infinite ones are skipped.
- evidence: read
- severity: low

## followScheme's OS-scheme subscription is never released
- where: apps/forge/mode.ts:22 (followScheme)
- scenario: `watchColorScheme(...)`'s unsubscribe is dropped. forge.frame calls `followScheme` at module scope, so each HMR update of forge.frame.tsx (or of fonts.ts or themes.ts, which it imports) adds another listener with its own `last` map. When the OS scheme changes, every stale copy re-applies its old `apply` (old theme and font code) to roots that are still connected, racing the current one. Expected: release the subscription on `import.meta.hot.dispose`, or return a disposer.
- evidence: read
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

<!-- done: 6 findings, files read: 22 -->
