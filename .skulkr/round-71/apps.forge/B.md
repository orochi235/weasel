# Audit round 71 — apps.forge

## KNOWN / JUDGED / UNSWEPT entries for a story file that no longer exists are never checked, so a rename leaves them stale forever
- where: apps/forge/a11y.suite.tsx:39 (judgeFile), apps/forge/a11y.suite.tsx:100 (describeA11y); apps/forge/a11y.known.ts:9, :63
- scenario: rename `ui/src/components/Badge/Badge.stories.tsx` to `Badge.examples.stories.tsx`. `judgeFile` runs only for paths the glob yields, so the old KNOWN key is never visited; the "still has every violation KNOWN lists for it" test, which is what makes the list "only shrink", never runs for it. The renamed file is now judged with no KNOWN entry (failing on contrast) while the dead entry sits in the table unnoticed. Same for UNSWEPT (ClockFrames) and JUDGED (BandEditor): nothing asserts each key names a globbed file, and nothing ever retries an UNSWEPT file to see whether it still faults. Should: one check that every key of KNOWN, JUDGED and UNSWEPT is a key of `modules` (after the `../../packages/` strip).
- evidence: read (all keys exist today, checked by Glob; the gap is the absent check)
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

<!-- done: 1 findings, files read: 23 -->
