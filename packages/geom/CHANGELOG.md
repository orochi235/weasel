# @weasel-js/geom

## 1.3.0

### Patch Changes

- 2621cbf: polygon-clipping is an optional peer of the ./booleans subpath, not a dependency
  
  geom's description promises a "dependency-free core; polygon booleans in the
  ./booleans subpath", and `booleans/index.ts` says the split exists "so the core
  stays `deps: {}`". The subpath split delivered that for the *import* graph only:
  `polygon-clipping` sat in `dependencies`, so every consumer installed it and its
  own two transitive deps — roughly half a megabyte — whether or not they ever
  imported the subpath that uses it.
  
  It reaches consumers through `@weasel-js/text`, which needs one type from geom
  (`Rect`, in `measure/lineBoxes.ts`) and none of its runtime. Nothing on that
  path can bundle the clipper, so it was pure install weight.
  
  **Anyone importing `@weasel-js/geom/booleans` must now install
  `polygon-clipping` themselves.** It is declared as an optional peer, so npm no
  longer installs it automatically and the subpath is the only thing that breaks
  without it. `@weasel-js/core` declares its own copy and is unaffected.
- 3386d64: Path command opcodes derive from one table
  
  `M`/`L`/`C`/`Q`/`Z` and their coordinate counts were declared five times —
  once in core, once in `@weasel-js/geom`, and three more as `COORD_COUNT`
  literals in the path transform, pose-rotation and pose-descriptor walkers. They
  agreed, and nothing held them to each other: a sixth opcode desynchronizes two
  packages' reading of the same `Uint8Array` with no exception and no type error,
  and every walker misparses the coordinate stream from that command on.
  
  `PATH_COMMANDS` in `@weasel-js/geom` is now the table. `PATH_M`…`PATH_Z`,
  `PATH_CMD_LENGTHS` and the new `pathCommandCoordCount` all derive from it, and
  core re-exports them by name, so the opcode constants keep their names, values
  and literal types. The three walkers moved onto `forEachSegment` rather than
  onto the accessor alone — they were duplicating the coordinate-cursor advance
  as well as the length, and the cursor is the half that actually misreads.
  
  Eight further files switch on these opcodes with inline literals. Five throw on
  an unknown code; three — the path boolean adapter, the anchor-editing geometry,
  and geom's own boolean adapter — have no `default` arm and would silently stop
  advancing. Left as-is; they need per-command semantics, not one walker.
- 84db1f6: Close four gaps that produced wrong answers with no error
  
  Three path walkers — `pathToMultiPolygon` in core and in `@weasel-js/geom`, and
  `enumerateAnchors` behind the bezier-edit overlay — handled M/L/C/Q/Z with no
  `default:` arm, so a command code they did not know fell out of the switch
  without advancing the coordinate cursor and every segment after it read the
  wrong floats. They now throw, matching the six sibling walkers. This is a
  behavior change for anyone feeding these a path built with an opcode outside
  `PATH_COMMANDS`: what used to come back subtly wrong now raises.
  
  A `<CanvasView>` built its affordance hit-test without a device profile, so a
  nested view resolved fine-pointer radii even under a coarse pointer — 8px grab
  zones against the 14px chrome the surface paints. It reads the profile
  `<SceneCanvas>` publishes.
  
  `moveGestureAdapter`'s `insertNode` took no `index`, and the adapter carried
  neither `getChildren` nor `setChildOrder`, so the sibling slot a delete op
  records had nowhere to land: undoing a delete through the move pipeline
  appended the node to the end of its parent instead of putting it back where it
  was. All three are there now.
  
  The dev inspector's gesture panel formatted bindings with a private formatter
  that reported only modifiers set to `true`. The `ingest` action marks every
  modifier `'optional'`, so its drop and paste bindings rendered blank and the
  action was invisible on both gestures. Both of the panel's plain-text
  formatters now go through the kit's `routesForSpec`.

## 2.0.0-pre.0

### Patch Changes

- 3386d64: Path command opcodes derive from one table

  `M`/`L`/`C`/`Q`/`Z` and their coordinate counts were declared five times —
  once in core, once in `@weasel-js/geom`, and three more as `COORD_COUNT`
  literals in the path transform, pose-rotation and pose-descriptor walkers. They
  agreed, and nothing held them to each other: a sixth opcode desynchronizes two
  packages' reading of the same `Uint8Array` with no exception and no type error,
  and every walker misparses the coordinate stream from that command on.

  `PATH_COMMANDS` in `@weasel-js/geom` is now the table. `PATH_M`…`PATH_Z`,
  `PATH_CMD_LENGTHS` and the new `pathCommandCoordCount` all derive from it, and
  core re-exports them by name, so the opcode constants keep their names, values
  and literal types. The three walkers moved onto `forEachSegment` rather than
  onto the accessor alone — they were duplicating the coordinate-cursor advance
  as well as the length, and the cursor is the half that actually misreads.

  Eight further files switch on these opcodes with inline literals. Five throw on
  an unknown code; three — the path boolean adapter, the anchor-editing geometry,
  and geom's own boolean adapter — have no `default` arm and would silently stop
  advancing. Left as-is; they need per-command semantics, not one walker.

- 84db1f6: Close four gaps that produced wrong answers with no error

  Three path walkers — `pathToMultiPolygon` in core and in `@weasel-js/geom`, and
  `enumerateAnchors` behind the bezier-edit overlay — handled M/L/C/Q/Z with no
  `default:` arm, so a command code they did not know fell out of the switch
  without advancing the coordinate cursor and every segment after it read the
  wrong floats. They now throw, matching the six sibling walkers. This is a
  behavior change for anyone feeding these a path built with an opcode outside
  `PATH_COMMANDS`: what used to come back subtly wrong now raises.

  A `<CanvasView>` built its affordance hit-test without a device profile, so a
  nested view resolved fine-pointer radii even under a coarse pointer — 8px grab
  zones against the 14px chrome the surface paints. It reads the profile
  `<SceneCanvas>` publishes.

  `moveGestureAdapter`'s `insertNode` took no `index`, and the adapter carried
  neither `getChildren` nor `setChildOrder`, so the sibling slot a delete op
  records had nowhere to land: undoing a delete through the move pipeline
  appended the node to the end of its parent instead of putting it back where it
  was. All three are there now.

  The dev inspector's gesture panel formatted bindings with a private formatter
  that reported only modifiers set to `true`. The `ingest` action marks every
  modifier `'optional'`, so its drop and paste bindings rendered blank and the
  action was invisible on both gestures. Both of the panel's plain-text
  formatters now go through the kit's `routesForSpec`.

## 1.2.0

## 1.1.0

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
