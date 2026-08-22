# Review: geom, gestures, history, modes

A correctness pass over `packages/geom`, `packages/gestures`, `packages/history`
and `packages/modes` — the pure-logic packages, decoupled from core for
publishing. For whoever picks up one of these packages next: it says what was
wrong, what changed, and what was left alone on purpose.

Every fix here was reproduced by a failing test before it was made, and every
test was mutation-checked (break the fix, watch the test fail, restore).
Verified with `tsc --noEmit`, `npm run lint`, `npm run test:kit` (4357 tests)
and `npm run test:ui` (1544 — the project that actually runs these packages'
suites; `test:kit` covers core, which consumes them).

## Fixed

**geom — a path's own holes were discarded before every boolean op.**
`pathToMultiPolygon` emitted each ring as its own `polygon-clipping` polygon.
The polygons of a MultiPolygon are unioned, so a donut reached the clipper as a
solid disc: `pathSubtract(donut, farAwayRect)` returned a filled square, and an
intersect against the hole returned area that should not exist. The path's
`fillRule` was never read. Rings are now grouped into outer + hole polygons by
containment — nesting parity under `evenodd`, summed winding under `nonzero`.
Containment is probed from each ring's first-edge midpoint rather than a vertex,
because a hole sharing a vertex with its container is common and a probe point
lying exactly on the boundary being tested answers arbitrarily.

**geom — `flattenCubic` had two non-terminating inputs.** A non-finite control
point made the flatness test unsatisfiable (stack overflow) and `tolerance <= 0`
made it unreachable (`out` grew past the maximum array length). The test is
negated so a NaN deviation reads as flat, and subdivision is capped at 16
levels. Error falls roughly 4x per level, so 16 is ~4e9 tighter than the
starting chord — no call that terminated before reaches the cap, and flattened
geometry is unchanged.

**geom — `approxEq` was wrong at both ends of the range.** `Infinity/Infinity`
is 1, so the relative test passed for any finite value against an infinity;
meanwhile two identical infinities compared unequal because the guard tested
`diff === 0` rather than `a === b`.

**geom — `invert` used an absolute determinant epsilon.** It rejected
`scale(1e-7)`, which is perfectly invertible, while accepting
`[1e6, 1e6, 1e6, 1e6+eps]`, whose determinant is pure cancellation. The
determinant is an area, so it is now judged against the squared column norms.
A non-finite matrix returns `null` instead of a matrix of NaNs.

**history — coalescing merged into entries it should not.** `canCoalesce` only
consulted the top of the undo stack and a timestamp. Edit A, edit B, undo B,
then edit C with a key matching A and inside the window: C rewrote A's forward
ops in place. The stack held one entry, still labelled A, and one undo jumped
past both edits. A merge target is now the entry the last push created and
nothing else — the window is keyed on the version counter, which every other
operation bumps, so undo, redo, goto, clear, restore and `recordEntry` all close
it with no per-site clear to forget. That also makes the redo-drop on the
coalesce path unreachable (a live window implies an empty redo stack), so it is
gone, along with `onEvict`'s claim that coalescing is one of its sources.

**history — two journals could be active at once.** `resumeJournal` never
consulted `activeJournal`, so both `suspend → resume → beginJournal` and
`suspend → beginJournal → resume` produced two live journals writing to the
same adapter with independent inner histories. It now refuses while a different
journal is active, and re-registers the one it resumes.

**gestures — the `'*'` wildcard leaked into route strings and prose.**
`parseRoute` fills an omitted arg slot with `'*'` for any gesture whose
descriptor declares no default (`drop`, `paste`, `multiTouchTap`, the key
gestures). `formatRoute` re-emitted it, so `[*:*] drop` came back as
`[*:*] drop(*)` and `formatRoute ∘ parseRoute` was not idempotent;
`describeRoute` printed it literally ("the user drops * content onto the
canvas", "taps with * fingers"), its `?? 'any'` fallbacks unreachable.

**gestures — `LongPressEvent` and `LongPressSpec` were not exported.** They are
arms of the public `InputEvent` and `GestureSpec` unions, so a consumer could
receive one and not name its type. Caught by `tsc`, not by vitest — the export
test asserts it at type level.

Two docstrings asserted things the code does not do and were corrected rather
than acted on: `segmentsCross` says "properly crosses" but counts endpoint
contact, which is what its three hit-test callers want; `GestureArgSpec` says a
missing `default` is legal only for `'free'` args, but `multiTouchTap` has
enumerated values and no default.

## Deliberately not fixed

- **`boxToBox` guards a degenerate source box with `sw === 0`**, so a 1e-18-wide
  box yields a scale of 1e20 rather than the identity the exact-zero case gets.
  This is the seam the polygon-resize rebase settled on and a relative guard
  changes which inputs count as degenerate; it wants its own change with the
  resize suite in view, not a drive-by.
- **`goto(n)` bumps the version even when already at `n`**, causing a spurious
  re-render. `clear()` guards the equivalent case, so the inconsistency is real,
  but it is not a correctness bug and the fix does not belong in this diff.
- **`mimeMatchesGlob` fails a MIME with parameters** (`text/plain;charset=utf-8`
  does not match the glob `text/plain`). Real clipboard payloads carry
  parameters, but stripping them silently changes which drop and paste bindings
  fire, and no caller in the tree currently passes one.
- **`createModeDecorations` drops the unsubscribe** returned by
  `registry.subscribe`. There is no dispose on `ModeDecorations` to hang it on;
  adding one is API design, not a fix.
- **`History.undo`/`redo` are callable while a journal is active**, which
  interleaves parent and journal ops against one adapter. Whether that should
  throw is a lifecycle decision, not an oversight to patch.
- **`packages/core/src/features/paths/flatten.ts` holds a second copy of
  `flattenCubic`** with the same non-termination, and core's own
  `booleans.adapter.ts` is a parallel copy of geom's. Both are outside this
  review's area. The geom fixes do not reach them.

## Not verified

- The visual, perf and e2e suites were not run — they bind fixed ports and other
  agents were working concurrently. Nothing here should move rendered geometry:
  the flatten depth cap is unreachable for terminating input, and the boolean
  ring nesting only changes results for paths that have holes, which previously
  produced a wrong answer. Worth a `test:visual` run before merge on that last
  point.
- `modes` was read in full and no defect was found; it holds no numerics and no
  state machine beyond the registry.
