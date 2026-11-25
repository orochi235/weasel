Disabled BarMenu opens its menu on click or Enter (A+B): not a defect. `ButtonTooltip` makes the button natively `disabled` when there's no reason. With a reason, it sets `aria-disabled` and `data-disabled`, refuses `onClick`, and drops `onPointerDown`. I ran it under both `<Disabled when reason>` and `<Bar disabled disabledReason>`, and no menu opened either time. The existing test "stays shut in a disabled bar" passes.

Bar.Item with a repeated id still made a reorder unit (A+B): fixed 3442df2adf

Curved bar drops `framed`, `wrap`, and the status footer (A): fixed a6f88acc09. This needed a behavior call. A status bar along a curve is now a `<footer>`, and `framed` or `wrap` there warns instead of drawing a strip. The call is recorded in `docs/unruled.md`.

Menu-mode spacer's grown width locks in `--bar-natural` (A): fixed 84b219330a

Refused keyboard reorder leaves a pending refocus that steals focus later (A): fixed 4f7b4671fa

`aria-keyshortcuts` left on controls after `onReorder` is removed (B): fixed 33e480b639

Arc lab computes the popover side with its own copy of `sideOf` (B): fixed 8d44453ad5. The lab now uses `barSide`'s `sideOf`. It still takes the normal from the drawn geometry, so the check stays independent. This is a refactor with no behavior change, so it has no failing test and no changeset.

[r56-1] Stories use deleted CSS classes (carried): not a defect (no longer applies; `stories.classes.test.ts` passes)

[r56-2] Held bar's menu button still opens its menu (carried): duplicate of the disabled BarMenu finding above, not a defect for the same reason

[r56-3] Wrapped-bar drop picks its gap by x alone (carried): not a defect (no longer applies; BarLine measures through `wrappedPosition` when `wrap`)

[r56-4] Curved bar drops `fit` (carried): not a defect (no longer applies; BarAlong builds a `FitScope` measured against the run)

[r56-6] useMenuLeast near-zero width under right-to-left (carried): not a defect (no longer applies; it measures the min/max extent of the button and lead together)

[r56-7] Alt+arrow at a container's end moves roving focus (carried): not a defect (no longer applies; the chord is claimed at an end before returning)

[r56-8] useBarOverflow's size cache keeps every key (carried): not a defect (no longer applies; `measure` prunes keys no longer held)

Checks:
- `npx vitest run --maxWorkers=1` on `barItems.test.tsx`: 5 passed (5)
- `Bar.along.test.tsx`: 27 passed (27)
- `Bar.natural.test.tsx`: 4 passed (4)
- `useBarReorderKeys.test.tsx`: 17 passed (17)
- `stories.classes.test.ts`: 1 passed (1)
- `BarMenu.test.tsx`: 8 passed (8)
- `useBarOverflow.test.tsx`: 1 passed (1)
- `Bar.over.test.tsx`: 8 passed (8)
- `Bar.test.tsx`: 14 passed (14)
- `npm run checks:gate`: all 32 passed. The first run failed `check:changesets` on three titles over 140 characters; I fixed them in their own commits and the rerun passed.
- `npm run lint -w @weasel-js/ui`: fail, because the package has no `lint` script. I ran `npx eslint src/components/Bar` in its place: pass, no output.

tally: 6 of 14 fixed, 0 extra fixed