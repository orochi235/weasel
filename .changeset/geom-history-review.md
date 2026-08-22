---
'@weasel-js/geom': patch
'@weasel-js/history': patch
'@weasel-js/gestures': patch
---

Fixes seven correctness faults found by review of the pure-logic packages.

**geom.** `pathToMultiPolygon` handed every ring to `polygon-clipping` as its
own polygon, and the polygons of a MultiPolygon are unioned — so a path with
holes arrived at the clipper solid, and the path's `fillRule` was never read at
all. Rings are now grouped into outer + hole polygons by containment, under
either fill rule. `flattenCubic` could not terminate on a non-finite control
point or a non-positive tolerance; it now treats a non-finite deviation as flat
and caps subdivision at 16 levels, which is far beyond what any terminating
call reaches, so flattened geometry is unchanged. `approxEq` called every
finite number equal to an infinity while calling two identical infinities
unequal. `invert` judged the determinant against an absolute epsilon, rejecting
a well-conditioned uniform 1e-7 scale while accepting a large matrix whose
determinant is pure cancellation; the test is now relative to the squared
column norms, and a non-finite matrix returns null instead of NaNs.

**history.** Coalescing merged into whatever entry the undo stack left on top,
so an edit made after an undo could rewrite an older entry in place — leaving
one entry, still under the older label, that a single undo stepped past. A
merge target is now the entry the last push created and nothing else.
`resumeJournal` ignored which journal was active, letting two journals write to
the same adapter with independent inner histories; it now refuses while another
is active.

**gestures.** `parseRoute` fills an omitted arg slot with the `'*'` wildcard for
gestures whose descriptor declares no default. `formatRoute` re-emitted it
(`[*:*] drop` came back as `[*:*] drop(*)`, so format ∘ parse was not
idempotent) and `describeRoute` printed it literally ("the user drops * content
onto the canvas"). Both now treat it as the wildcard it is. `LongPressEvent` and
`LongPressSpec` — the one arm of the public `InputEvent` / `GestureSpec` unions
the barrel never named — are exported.
