An `undefined` base or effect param keeping its default (A+B): fixed 7c1d00565d
A padding change leaving a fitted badge's insets stale (A+B): fixed 435f55a601
The `padding` prop dropping the shape's insets while useInsets fits as if they add (A): fixed 13a5767c32. Question (whether a padding should add to the insets rather than replace them): I kept replacement, which the story describes and the prop has always done, and recorded it in `docs/unruled.md`. The prop's doc now says it replaces the insets. `ownPadding` no longer takes the inset out of a side whose padding was overridden; before, that made a fitted badge with a partial `style` padding pad its other sides further than they needed.
The remove control ringing a plain removable badge but not one with an action (A): fixed 651fc74324
types.ts calling `square` CSS-drawn (A): fixed 20b525639f (doc only, no changeset)
A lone `var()` padding shorthand copied onto every side (A): fixed 5263a3df54. This also covers `paddingBlock` and `paddingInline` in `style`.
`labelProps` className and aria-label overwritten on the label (B): fixed 070ba77069
A span badge's `onClick` running only when a tooltip splits it (B): fixed e620689195. Question (whether a span badge should run `onClick` at all): I made the strict call that a span badge never does, and recorded it in `docs/unruled.md`.
Duplicate: A's "an effect or base param set to undefined" is the same finding as B's first, fixed in 7c1d00565d
Duplicate: A's "measured own padding goes stale" is the same finding as B's fourth, fixed in 435f55a601

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own: Badge.test.tsx 47 passed, composeSpec.test.ts 1 passed, composeOutline.test.ts 7 passed, paddingSides.test.ts 11 passed, useInsets.test.ts 1 passed, fittedOutline.test.ts 30 passed.
- Badge.browser.test.tsx: unrun, browser test (not touched).
- `npm run check:changesets`: pass. It first failed on three titles over 140 characters, which I shortened and folded into their commits.
- `npm run checks:gate`: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/ui`: fail, "Missing script: lint". The package has no lint script, so I ran `npx eslint` on every changed .ts and .tsx file: pass (exit 0). The gate's root `npm run lint` also passed.
- Tree clean.

tally: 8 of 10 fixed, 0 extra fixed