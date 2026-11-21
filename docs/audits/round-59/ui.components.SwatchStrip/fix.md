- Story feeds the field placeholder black after "None" without `unset` (A): fixed 123c1056f6. This is a story-only change with nothing a consumer sees, so it has no changeset. The new `SwatchStrip.stories.test.tsx` checks it.
- The provider wrap depends on whether `store` equals the context's store, so swatches remount (A): fixed 3b8e2f5f1a. The strip now wraps whenever it has any store, so the grids also stay mounted when the prop stops matching the provider.
- Current swatch match compares non-hex colors by their exact spelling (B): fixed 98f9655107. Both colors now go through paint's `tryParseColor` to `#rrggbbaa`, and fall back to `normalizeRecentColor` for anything paint can't read.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/SwatchStrip/SwatchStrip.test.tsx`: pass (14/14)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/SwatchStrip/SwatchStrip.hold.test.tsx`: pass (6/6)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/SwatchStrip/SwatchStrip.stories.test.tsx`: pass (1/1)
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed `check:changesets` because both titles were over 140 characters; I shortened them, squashed the edits into their commits, and reran.
- `npm run lint -w @weasel-js/ui`: not run, because `@weasel-js/ui` has no `lint` script (npm error: missing script). Instead, eslint on the four changed files: pass (exit 0)
- The tree is clean.

tally: 3 of 3 fixed, 0 extra fixed