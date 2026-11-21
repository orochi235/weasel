- well end cap not re-measured when segments arrive or the first one changes (A+B) — fixed ec8e57d299
- tiled bar's vertical corner rules override its tile corners (A) — fixed e05d287893 (a tiled row now writes no `data-orientation`)
- `steps` bar silently drops steps past the 256 cap (A) — fixed 1f25cd28ad. I made the call myself and recorded it in `docs/unruled.md`: the bar warns once, and a new `cap` prop turns the warning off.
- Escape mid-sweep, then the release's click toggles the pressed segment (A+B) — fixed 3aba748466 and edea9160c4. The reviewers' premise was wrong as written: Escape never cancelled a segment sweep, because the sweep's dispatcher runs with `keyboard: false`, even though the `sweep` docs say Escape restores the segments. edea9160c4 makes Escape cancel the sweep. 3aba748466 keeps the click guard up after any cancel with the button still held (window blur, or now Escape) until the pointer is released. It is shared with ToggleChips and CheckboxGroup.
- curved well draws no forced-colors state (A) — fixed e84464f31d
- lab each-mode bar has no-op `onChange`s, and its top bar keeps a value that isn't among its items (A+B) — fixed 0666643b9f
- mixed segment draws as off in the `flat` variant (B) — fixed b3efb07ba1
- turning `sweep` on or off remounts the bar (B) — not a defect: React matches a top-level unkeyed fragment's first child by index and reuses the `Disabled` scope. A test showed the segment buttons kept the same nodes before any change.
- sweep stops working when the row's root element is replaced (B) — fixed e143404782 (the sweeper is keyed on curved or straight)
- wrapped `flat` bar pulls later rows 1px left (B) — fixed 4753c73d6b

Extra:
- the `minimal` and `flat` hover rules wiped the mixed wash under the pointer (sweep) — fixed in b3efb07ba1. It was the same mistake as the flat mixed finding, so it went in that commit.

Checks:
- `npx vitest run --maxWorkers=1` passed for each touched file:
  - `segmentsAlong.test.tsx`: 12 passed
  - `SegmentedBar.sweep.test.tsx`: 12 passed
  - `SegmentedBar.test.tsx`: 26 passed
  - `SegmentedBar.grid.test.tsx`: 4 passed
  - `lab/SegmentsArcView.test.tsx`: 2 passed
  - `ToggleChips.test.tsx`: 13 passed
  - `CheckboxGroup.test.tsx`: 8 passed
  - `SegmentedBar.each.test.tsx`: 7 passed
  - `SegmentedBar.momentary.test.tsx`: 8 passed
  - `SegmentedBar.each.sweep.test.tsx`: 1 passed
- Unrun (browser): `segmentedControl.browser.test.tsx` (flat and minimal mixed, flat grid alignment) and `forcedColors.browser.test.tsx` (curved bar).
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed typecheck on a listener type in `segmentSweep.tsx`; that was fixed and folded into 3aba748466.
- `npm run check:changesets`: OK.
- `npm run lint -w @weasel-js/ui`: fails because `@weasel-js/ui` has no `lint` script. `npx eslint` on `packages/ui/src/components/Segmented` and `forcedColors.browser.test.tsx` passed (exit 0, no output).
- The tree is clean.

tally: 12 of 13 fixed, 1 extra fixed