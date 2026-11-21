ShortcutSheet draws Ctrl+"+" as one "Ctrl++" chip and its search can't find it (A): fixed b7b86e1bf6 (parser reads a trailing `++` as the `+` key) and c0d679fe95 (rows draw chips from the shortcut data, which keeps the optional-Shift chip; 2bfa99e80f adds `ShortcutKeys`' `format` prop for this)
ShortcutSheet keys a row's chips by formatted legend, so two bindings that read alike (`a`/`A`) collide (B): fixed c0d679fe95 (one chip per distinct legend, keyed by it)
Untitled SidebarPanel drops `onHide`, `actions`, `trailing`, `headerRef` and its fold control (A): fixed 1162538641 (the header shows when any part is given or the panel folds; an untitled fold control is named "Contents", recorded in `docs/unruled.md`)
SpanStrips with no `at` rounds the second-to-last row's corners (A): fixed d9dfd0c447
SpanStrips with no `at` rounds the wrong row (B): duplicate of A's SpanStrips finding, fixed d9dfd0c447
rulerTicks has no cap on tick count, loops forever on a non-positive step, and drifts under a fractional step (A): fixed 5bbc6df3cd (the fallback takes a whole multiple of the last step; a step that is not a positive finite number throws `RangeError`, recorded in `docs/unruled.md`; ticks are computed as `origin + i*step` with float slack)
Switch hands a stale modifier set to `onChange` after a click that changed nothing (A): not a defect. A native checkbox only changes through a click event, and a keyboard Space fires one too. That click's capture handler rewrites `mods` before `onChange` runs, so a stale Alt never reaches a change.
Switch does not mirror under RTL (A): fixed fdf2481be8 (`inset-inline-start`, plus a `:dir(rtl)` flip of the translate)
Sequence keys cells by position, so state moves to another step (A): fixed 930af12fb8 (keyed by the step's label, with an occurrence count to tell repeated labels apart)

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1`: pass on each of keyLegendsFromFormatted.test.ts (4), ShortcutKeys.test.tsx (5), ShortcutSheet.test.tsx (7), SidebarPanel.test.tsx (14), SpanStrip.test.tsx (18), Switch.test.tsx (5) and Sequence.test.tsx (7).
- Unrun (browser): packages/ui/src/components/SpanStrip/SpanStrips.browser.test.tsx and packages/ui/src/components/Switch/Switch.browser.test.tsx.
- `npm run checks:gate`: pass, "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/ui`: not run, because `@weasel-js/ui` has no `lint` script (npm reported a missing script). Instead, `npx eslint` on every changed .ts/.tsx file: pass. `npm run typecheck:packages -- ui`: pass, "1/1 ui ok".
- `npm run check:changesets`: pass, "OK — 3095 changeset(s)".
- Tree clean.

tally: 8 of 9 fixed, 0 extra fixed