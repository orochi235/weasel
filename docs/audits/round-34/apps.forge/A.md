
## csf.mjs's labkit and draw checks read the host's direct children, which have been forge's scroller since 2b1aeb54f4
- where: apps/forge/e2e/csf.mjs:22 and :47 (stories[1].check, stories[3].check)
- scenario: since 2b1aeb54f4 (2026-10-20) TrialHost renders `.fg-story[data-fg-host] > .fg-story__scroll > (LabBoundary/OverlayPortalProvider) > story`, and in dev (where the script runs, against `ports.forge`) `devtoolsDock` adds a `display: contents` `<div class="bare">` around every story too. So `host.querySelector(':scope > .lk-root, :scope > [data-wzl-theme] > .lk-root')` can never match, and the `labkit-primitives-jobprogress--determinate` check always throws "the story's root has no .lk-root ancestor" even when LabRoot wrapped the story. The draw check's `host.firstElementChild` is the scroller and not the story, so it measures the scroller's rect: a story rendered off screen or with zero height inside a visible scroller still passes. Both checks should look past the host's wrappers (e.g. `host.querySelector('.lk-root')`, or the scroller's first real descendant box).
- evidence: read (packages/forge/src/shell/TrialHost.tsx:55-61, 138-153; StoryScroller.tsx:9-22; apps/forge/devtools.tsx:23-32)
- severity: medium

## csf.mjs writes the screenshots of its three JobProgress checks to one path, so each overwrites the one before
- where: apps/forge/e2e/csf.mjs:173 (main loop)
- scenario: stories[3], [4] and [5] all have id `labkit-primitives-jobprogress--determinate`, and the shot path is `${shots}/forge-csf-${story.id}.png`. Every run prints three different "ok … <path>" lines naming the same file; only the last check's screenshot survives, so the screenshot the CSS Vars check or the .lk-root check reports is not the one on disk. The path should include the index (or a per-check name).
- evidence: read
- severity: low

## Files read
apps/forge/DevtoolsDock.tsx
apps/forge/devtools.module.css
apps/forge/devtools.tsx
apps/forge/e2e/csf.mjs
apps/forge/e2e/smoke.mjs
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

<!-- done: 4 findings, files read: 17 -->
