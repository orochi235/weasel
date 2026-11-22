# Audit round 71 — apps.forge

## KNOWN / JUDGED entries naming a file the sweep no longer globs are never checked, so a stale entry outlives its story
- where: apps/forge/a11y.suite.tsx:39 (judgeFile), :82 (still-has-every-violation test); apps/forge/a11y.known.ts:9
- scenario: a story file listed in KNOWN (e.g. `ui/src/components/Badge/Badge.stories.tsx`) is renamed or moved. `judgeFile` runs only for paths `import.meta.glob` returns, so the "still has every violation KNOWN lists for it" check never runs for the old key. The entry stays forever, and the moved file shows up unknown (the sweep fails, and the fix someone reaches for is a second KNOWN entry). Nothing compares KNOWN's (or JUDGED's) keys against `Object.keys(modules)`, so the promise that "the list only shrinks" (a11y.known.ts:7) does not hold. What should happen: the suite fails on a KNOWN/JUDGED/UNSWEPT key with no globbed file. Every key resolves today (checked with Glob), so this is latent.
- evidence: read
- severity: low

## UNSWEPT entries are never checked again, so a story whose fault is fixed stays out of the sweep for good
- where: apps/forge/a11y.suite.tsx:40-43 (judgeFile); apps/forge/a11y.known.ts:63
- scenario: `ClockFrames.stories.tsx` is skipped with `it.skip` for as long as its UNSWEPT entry exists. When the `usePlayhead` fault it records gets fixed, nothing notices: the file is never rendered, so axe never judges it and no test fails to say the entry is stale. KNOWN fails on an entry that no longer happens, but UNSWEPT has no matching check (for example, rendering the file and expecting the fault). The file stays unjudged without anyone deciding that.
- evidence: read
- severity: low

## Files read
apps/forge/DevtoolsDock.tsx
apps/forge/a11y.known.ts
apps/forge/a11y.ring.ts
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

<!-- done: 2 findings, files read: 23 -->
