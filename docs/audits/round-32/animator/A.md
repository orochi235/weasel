# Audit round 32 — animator findings

## TargetTable.remove accepts a row already removed, so two later adds hand out the same row
- where: packages/animator/src/targetTable.ts:224 (createTargetTable → remove)
- scenario: `t.remove(3); t.remove(3)` (or remove of a row never added, ≥ `high`) pushes 3 onto `free` twice and drops `size` by two; the next two `add` calls both answer 3, so two callers write one row and `size` undercounts (can go negative). Should refuse (throw) a row not in use, as `put` refuses a wrong-length value.
- evidence: read
- severity: medium

## TargetTable.add loses a row index when the value is the wrong length
- where: packages/animator/src/targetTable.ts:207 (createTargetTable → add)
- scenario: `add([1,2])` on a 3-axis table: the row is taken (`free.pop()` or `high++`) before `put` throws on the length. The index never returns to `free`, `size` is not counted, yet `rows()` (`inUse(high, free)`) reports it as in use, so the animator's side and `size` disagree and a popped free row is leaked for good. Validate before taking the row.
- evidence: read
- severity: low

## loop/tweenLoop take any `count`: NaN loops forever, a fraction runs a different number of passes each way
- where: packages/animator/src/loop.ts:27,49-60 (createLoop)
- scenario: `count` is never checked. `count: NaN` → `i >= NaN` is never true, so the loop never ends (and `fromEnd` is false since `NaN < Infinity` is false). `count: 2.5` forward runs passes 0,1,2 (three); started at its end in a loop run back, `pass = 2.5` and the factory is handed `iteration` 1.5 then 0.5 (two passes, fractional indexes, so tweenLoop's `alternate` test `i % 2 === 1` never flips). Should refuse a non-integer/NaN/negative count (RangeError, as tween `ms` and timeline `duration` do) or floor it.
- evidence: read
- severity: low

## A staggered item whose factory throws leaves the stagger registered for good and drops the items due beside it
- where: packages/animator/src/stagger.ts:114-124 (CompositeHandle.fireDue), :231-240 (runStagger fire)
- scenario: `animator.stagger(items, 50, (item, i) => { if (i === 2) throw …; return animator.tween(…) })`. At item 2's frame, `fireDue` has already removed every due entry from `pending`; `p.fire()` throws, frame.ts:118-119 catches and logs it, and the items due after it in that same `due` list never start and are never rescheduled. `outstanding` counts them (and the thrower) still, so `noteChildDone` never reaches 0: the supervisor entry (whose tick never finishes) stays in the table forever, `animator.isActive(key)` stays true, the frame loop never idles, and `onDone`/`end` never come. Should count the thrown item as done (or cancel the stagger) and fire the rest. The same throw for an item with delay ≤ 0 escapes `runStagger` after the supervisor is registered and earlier children started, so the caller never gets a handle to cancel them.
- evidence: read
- severity: medium

## createElementTarget with `get` but no `set` (or `set` but no `value`/`get`) silently drops every commit
- where: packages/animator/src/elementTarget.ts:84-88 (createElementTarget)
- scenario: the guard only refuses "no `get` and no `value`". Given `get` alone, `set` falls back to writing the private `held`, which `get` never reads: an animation commits its destination into `held`, `get()` still answers the caller's value, and the target comes to rest back at where it started instead of at `to`. Given `value` and `set` alone, `get` answers `held`, which the caller's `set` never updates, so the committed value is frozen at `value` and every animation snaps back to it. Both halves of the pair are needed together; one alone should throw, as the doc ("Give `get` and `set` instead") implies.
- evidence: read
- severity: medium

## A joint name with a dot is read as a path: `axes: ['spine']` also takes `spine.001`, `spine.002`…
- where: packages/animator/src/rig/skeletonAxes.ts:10-12 (axisNames), packages/animator/src/axisNames.ts:37-40 (axisIndexes)
- scenario: axes are named `<joint>.<field>` and a name matches every axis starting with `<name>.`. A skeleton with joints `spine`, `spine.001`, `spine.002` (Blender's default numbering) or `upper_arm` beside `upper_arm.L`: `animator.hold({ target: rig.target, axes: ['spine'] })` or `jointAxes(skeleton, ['spine'])` resolves to all three joints' fifteen axes, so a hold meant for one joint holds the whole chain and a release commits it. Joint names are free strings (`Joint.name`), and nothing refuses a dot in one, so the path syntax and the names collide; it should match a joint name exactly (`names[i] === w + '.' + field`) or refuse dotted joint names.
- evidence: read
- severity: medium

## `Target.commit` on a resting target never reaches its `show`, so an element target's style goes stale
- where: packages/animator/src/target.ts:375-378 (createTarget → commit); packages/animator/src/elementTarget.ts:87-90
- scenario: `const t = createElementTarget({ element, value: 0, style: (v) => ({ opacity: v }) }); t.commit(1)` with nothing animating it: `commit` releases a handoff and calls `opts.set`, but `show` (which writes the element's inline style) runs only on frames the target moves, so the element keeps showing opacity 0 while `read()`/`committed()` answer 1, until some later animation happens to show it. A target table answers the same call the other way: its row commit (targetTable.ts:165-170) writes `shown` and calls the table's `set` when the row is at rest. A plain target with `show` should be shown on a commit at rest too (or the doc should say a commit is not shown).
- evidence: read
- severity: medium

## `jointShares` counts weights `skinPath` ignores, so the brush works against a share the skin never applies
- where: packages/animator/src/rig/weightEdits.ts:68-74 (jointShares) vs packages/animator/src/rig/skin.ts:66-72 (skinPath)
- scenario: `skinPath` skips any weight that is not `> 0` (negative, NaN). `jointShares` sums every weight into `total`: a point weighted `{ a: 1, b: -0.5 }` applies as wholly `a` (share 1) but `jointShares` answers 2 for `a`; one weight NaN makes `total` NaN and every joint's share 0 at that point, though `skinPath` moves it by the rest. `brushWeights` then compares against the wrong share (its doc says it compares "as the skin is applied"). Sum only `w > 0`, as `skinPath` does.
- evidence: read
- severity: low

## staggerVertexColors with `anchorMs: 0` paints NaN: the origin anchor's progress is 0/0 at the tween's start
- where: packages/animator/src/colorHelpers.ts:186 (staggerVertexColors → colorsAt)
- scenario: `staggerVertexColors(animator, { …, anchorMs: 0, perAnchorDelay: 30 })` (each anchor snapping in turn). The target tween evaluates its path at 0 as it starts (offsetTween.ts `first = offsetAt(0)`), where the origin anchor has `elapsedMs - startMs = 0` and `0 / 0` is NaN; `Math.min(1, NaN)`/`Math.max(0, NaN)` keep NaN, so that anchor's four channels are NaN in the start offset (and again on any frame landing exactly on an anchor's start). Neither `anchorMs` nor `perAnchorDelay` is checked: a negative `perAnchorDelay` gives a negative `totalMs`. Should treat `anchorMs <= 0` as a step (`elapsed >= start ? 1 : 0`) and refuse non-finite/negative times with a RangeError, as `cycleVertexColors` does for `msPerCycle`.
- evidence: read
- severity: low

## ColorOverrideRegistry.target at a new length drops painted colors without notifying subscribers
- where: packages/animator/src/colorRegistry.ts:117-122 (ColorOverrideRegistry.target)
- scenario: a finished tween left `id`'s fill painted (slot.painted true, not released, e.g. it was canceled). `target(id, 'fill', otherLength)` drops that slot and installs a fresh unpainted one: `get`/`has`/`resolve` stop answering the painted colors, but `changed()` is never called, so a painter listening through `subscribe` keeps the old colors on screen until something else bumps it. `release` (line 171) emits for exactly this case (`if (slot.painted) this.changed()`).
- evidence: read
- severity: low

## ColorOverrideRegistry.set stores the caller's array by reference, so re-setting it after an in-place edit is now a silent no-op
- where: packages/animator/src/colorRegistry.ts:57-59 (ColorOverrideRegistry.set), added in f2eb510eaf (2026-11-15)
- scenario: `const c = solidVertexColors(4, 1, 0, 0); reg.set('n', 'fill', c); c[0] = 0; reg.set('n', 'fill', c)`. `entry[channel]` is `c` itself, so the second call compares `c` with `c`, finds them equal and returns without `changed()`: the version does not move and subscribers are not told, while `resolve` already answers the edited array, so a painter that repaints on `subscribe`/`version()` keeps the red it drew. Before that commit every `set` repainted. The trim registry avoids this by copying (`{ ...override }`); this one should keep a copy (`override.slice()`) to compare against.
- evidence: read
- severity: medium

## TargetTable.target answers a target for a row that is not in use, reading past the table or a freed row
- where: packages/animator/src/targetTable.ts:234-245 (createTargetTable → target)
- scenario: `table.target(500)` on a table of 3 rows (capacity 64): no check against `high`/`free`, so its `get` reads `committed[500 * n + k]` → `undefined` and the value is `[undefined, …]` (NaN once animated), and a commit writes past the array (a no-op on a typed array) while `shown` never holds the row. `target(r)` for a removed row likewise makes a live target that the next `add` silently hands to the new row's owner. Should throw for a row not in use, as the old-target check (`mine`) already does for a removed one.
- evidence: read
- severity: low

## TrimOverrideRegistry.has says an empty override paints while get/resolve say nothing does
- where: packages/animator/src/trimRegistry.ts:37-42, 67-71 (set, has)
- scenario: `trims.set(id, {})` or `set(id, { start: undefined })` (a caller clearing one edge by leaving it out): the map keeps an entry, so `has(id)` is true, but `resolve(id)`/`get(id)` answer `undefined` because neither edge is given. A painter that checks `has` before resolving takes a node as overridden with nothing to paint; and `set` with `{}` over a real override fires a change where `clear` was meant. Two answers to "does anything paint here"; `set` with no edge should clear the entry (or `has` should go by `resolve`).
- evidence: read
- severity: low

## Files read
packages/animator/src/axisNames.ts
packages/animator/src/colorArrays.ts
packages/animator/src/colorCycle.ts
packages/animator/src/colorHelpers.ts
packages/animator/src/colorInterpolate.ts
packages/animator/src/colorRegistry.ts
packages/animator/src/elementTarget.ts
packages/animator/src/createHostedAnimator.ts
packages/animator/src/index.ts
packages/animator/src/loop.ts
packages/animator/src/observe.ts
packages/animator/src/pbt.fixture.ts
packages/animator/src/react.ts
packages/animator/src/rig/autoSkin.ts
packages/animator/src/rig/mirrorPose.ts
packages/animator/src/rig/resolveSkeleton.ts
packages/animator/src/rig/skeletonAxes.ts
packages/animator/src/rig/skeletonEdits.ts
packages/animator/src/rig/skin.ts
packages/animator/src/rig/solveIk.ts
packages/animator/src/rig/types.ts
packages/animator/src/rig/weightEdits.ts
packages/animator/src/slew.ts
packages/animator/src/stagger.ts
packages/animator/src/staggerTypes.ts
packages/animator/src/supervisor.ts
packages/animator/src/tableMoves.ts
packages/animator/src/target.ts
packages/animator/src/targetTable.ts
packages/animator/src/targetTypes.ts
packages/animator/src/trimRegistry.ts
packages/animator/src/types.ts
packages/animator/src/useAnimator.ts
packages/animator/src/useAnimatorOptions.ts

<!-- done: 13 findings, files read: 34 -->
