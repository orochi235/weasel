# Audit round 34 — apps.forge (blind reviewer)

Note: commit 7192f7a6fc5b8fa10a7ab628983a47025811c0dc is not present in this repository (`git cat-file` reports a bad
object). I reviewed the working tree at HEAD 4c701b3803, where `git status` shows no changes under `apps/forge`.

## smoke.mjs's default URL opens forge/Counter, a story removed on 2026-09-25, so a run with no arguments always fails
- where: apps/forge/e2e/smoke.mjs:7 (default `url`), with the checks that depend on it at lines 70–79
- scenario: `node apps/forge/e2e/smoke.mjs` opens `#/forge-counter--counter`. Commit c1705be650 ("remove forge's
  Counter bring-up story and its story glob") deleted `apps/forge/stories/Counter.stories.tsx`, and no story glob in
  `viteShared.ts` holds a `forge/Counter` story. No host ever shows a `clicks: 0` button, so step 1 times out after
  15 s. The whole script (clicks, the `taps` label control, the `n` state in IndexedDB, and the `--expect-persisted`
  relaunch) is written around that one story, so it cannot pass against the current workshop. It should target a
  story that still exists, or the Counter fixture should come back.
- evidence: read (`git show --stat c1705be650`; git grep finds no Counter story in any stories glob)
- severity: medium

## csf.mjs's first check opens `ui-button--primary`, but ui/Button has no Primary story
- where: apps/forge/e2e/csf.mjs:10 (stories[0].id)
- scenario: none of the `ui/Button` story files (`Button.stories.tsx`, `Button.close.stories.tsx`,
  `Button.native.stories.tsx`, `lab/ButtonLab.stories.tsx`) exports `Primary`. `Button.stories.tsx` exports `Confirm`,
  `Solid`, `Ghost`, `Glass`, `Link` and others. The "ui story with argTypes" check therefore opens an id that names no
  story. If no host renders, it times out after 20 s and reports FAIL. If the workshop falls back to some other story,
  the check (any button, plus a "variant" label) passes against a story it never named. Either way it no longer tests
  what its `what` line says. It should name an existing id, such as `ui-button--solid`.
- evidence: read (grep for `Primary` across the ui/Button story files finds nothing)
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

<!-- done: 2 findings, files read: 17 -->
