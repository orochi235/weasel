- An unregistered outline name fell back to the built-in `rect`, not a registered `rect` that shadows it (B): fixed b860b390e7
- `roundRectOutline`'s `boxForContent` used the raw `maxRadius`, so `Infinity` sized an infinite box and a negative radius sized a box smaller than its content (A+B): fixed 3d4b32291e. It is also an exact inverse now. Strict call, recorded in `docs/unruled.md`: a negative or `NaN` radius throws `RangeError`, and `Infinity` means "always a sixth of the shorter side".
- `outlineFromD` accepted path data that doesn't parse, or that draws nothing, and a `content` box with no area (A): fixed e2440abcff. Strict call, recorded in `docs/unruled.md`: it throws, the same as a mark's `d`. Marks and outlines now share one parse-and-check helper, `parseUnitD` in `outlines/fromD.ts`, instead of two copies.

Extra defects found while fixing: none. The README lines on the `rect` fallback and on `outlineFromD` were updated to match; that edit sits in e2440abcff.

Checks:
- `npx vitest run --maxWorkers=1 packages/diagram/src/outlines/table.test.ts`: pass (16/16)
- `npx vitest run --maxWorkers=1 packages/diagram/src/outlines/roundRect.test.ts`: pass (5/5)
- Neighboring diagram tests, run one file at a time: `outline`, `selectionOutline`, `fromData.header`, `outlines/participants`, `outlines/builtins`, `marks`, `marks.pbt`: pass. `body*` and `sequence/` together: pass (157).
- `marks.browser.test.tsx`: unrun (browser test)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/diagram`: not run. The package has no `lint` script ("Missing script"). In its place, eslint on the changed files: pass (exit 0). The root `npm run lint` inside the gate: pass.
- `npm run check:changesets`: pass ("OK — 2029 changeset(s)")

One loop of mine passed `ls -l` output to vitest by mistake and started an unfiltered vitest run locally. I stopped it, and it wrote no files. The tree is clean apart from `.skulk/`.