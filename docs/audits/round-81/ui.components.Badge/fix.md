The `padding` prop adds to a shape's insets (inset only) and replaces them (fit code): fixed 785433d873 (A+B). This follows the round-58 ruling the stylesheet already ships. Round 61 ruled the reverse the same day without seeing round 58's change. `ownPadding` now always takes out the inset, the prop's doc says the insets add, and the round-61 line in `docs/unruled.md` is replaced by a note on round 58's entry.

A fitted base given `padding` flips between two fits on every render (A): fixed 785433d873. It was a consequence of the finding above, so the same commit fixes it.

A lone `var()` padding skips the insets, but `ownPadding` still subtracts them (A): fixed c070a4154c. `ownPadding` now subtracts no inset on a side that plain inline padding covers. One part is still open: on pill and plain badges, the label's hit area under a lone `var()` padding is still sized from the size's padding. That can't be fixed in CSS, because the stylesheet can't split one `var()` into four sides.

A lone `var()` padding drops any per-side padding given beside it (B): fixed c070a4154c. Such a side is now set as plain inline padding. A `padding` shorthand in `style` now replaces the `padding` prop, as CSS would.

Enter and Space on a split button-label skip the `labelProps.onClick` veto (A+B): fixed 98c09e98fd. The keys now dispatch a click.

An unknown `base` throws away the shape's own composition and draws nothing (B): fixed d0898841d2. It now falls back to the shape's own composition, as an unknown `shape` falls back to a pill.

Catalog lookups throw an unclear TypeError on a name the registry doesn't hold (B): fixed 2ae57bfd10. Nobody had ruled on this, so I made the strict call: they throw a `RangeError` naming the key, recorded in `docs/unruled.md`.

Checks:
- `npx vitest run --maxWorkers=1` on `useInsets.test.ts`, `paddingSides.test.ts`, `Badge.test.tsx`, `composeSpec.test.ts`, `catalog.test.ts`, `Badge.props.test.tsx`, `useInsets.test.tsx` and `bases/baseParams.test.ts`: pass. Each new test failed against the code before its fix.
- `npm run checks:gate`: pass (all 33 passed).
- `npm run check:changesets`: pass, with no warnings on the new changesets.
- `npm run lint -w @weasel-js/ui`: not run. `@weasel-js/ui` has no `lint` script ("Missing script"). The root `npm run lint` passed inside the gate.

tally: 7 of 7 fixed, 0 extra fixed