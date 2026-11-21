Empty value throws on render (A+B): fixed 3a92f84288. An empty list now draws an empty strip. I logged that call in `docs/unruled.md`: an empty list is treated as not loaded yet, so there is no throw and no warning.

Previewing `onRangeInput` shrinks the axis under an inward edge drag (A): fixed ae2c87f192

Home/End on a range end do nothing and `aria-valuemin`/`aria-valuemax` can't be reached (A+B): fixed f55e0b0ad0. A range end now stops one key step (1% of the track) short of the other end when no locked band holds the range open. That applies to drags as well as keys. I logged the call in `docs/unruled.md`. The existing value-triple test now expects 99 and 1 where it had 100 and 0.

Range end ignores PageUp/PageDown, and `KEY_STEP` is defined twice (A): fixed 0384fef006

Edge drag can't snap to ticks outside the range (B): fixed 7a6f1a6b52

A split band takes the first tagged band's tag, and the payload lookup goes wrong when bands share a payload (B): fixed 57910d2b3f

Rescale sends untouched seams through track units and back, so they drift (B): fixed b0cfc17769

Empty `value` throws during render (B): duplicate of the first finding

Range edge's ARIA bound can't be reached and Home/End does nothing (B): duplicate of the third finding

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/BandEditor/BandEditor.test.tsx`: pass (85)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/BandEditor/BandEditor.edgeCases.test.tsx`: pass (9)
- `bands.test.ts`, `bands.pbt.test.ts`, `scale.test.ts`, `BandEditor.hold.test.tsx`: run together with `--maxWorkers=1` rather than one at a time; pass (37)
- `npm run checks:gate`: `checks:gate: all 32 passed`. The first run failed `check:changesets` on three titles over 140 characters; I shortened them and folded each fix into its own commit.
- `npm run lint -w @weasel-js/ui`: not run, because `@weasel-js/ui` has no `lint` script (npm prints its list of scripts instead). The gate's root `npm run lint` passed.
- Browser tests: none touched.

Tree clean.

tally: 9 of 9 fixed, 0 extra fixed