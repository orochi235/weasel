# @weasel-js/history

## 1.0.4

### Patch Changes

- bd42540: Fixes seven correctness faults found by review of the pure-logic packages.

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
  idempotent) and `describeRoute` printed it literally ("the user drops \* content
  onto the canvas"). Both now treat it as the wildcard it is. `LongPressEvent` and
  `LongPressSpec` — the one arm of the public `InputEvent` / `GestureSpec` unions
  the barrel never named — are exported.

## 1.0.3

### Patch Changes

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

## 1.0.2

## 1.0.1

## 1.0.0

## 0.8.0

## 0.7.2

### Patch Changes

- 8bc719a: Every package now declares `engines.node: ">=22"`, up from `">=20"`. Node 20
  reached end of life on 2026-04-30, so the old floor advertised support for a
  runtime that no longer receives security patches — a claim in each published
  tarball that had quietly stopped being true. `@weasel-js/labkit` had no `engines`
  field at all and now matches its siblings.

  Nothing in the kit required a Node 20 feature, so this changes what is promised
  rather than what runs. CI tests both ends of the range: the 22 floor and the 24
  Active LTS the release and docs workflows build on.

## 0.7.1

## 0.7.0

## 0.6.0

## 0.5.1

## 0.5.0
