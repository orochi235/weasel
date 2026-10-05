# The animator on blits

**Status: steps 1, 2 and most of 3 are built, on branch `pose-overrides-mix`, unmerged.** Tweens,
springs, physics and decay compute their values in blits ("What step 3 built"). Keyframe sampling,
the rest of step 3, and steps 4–6 are not built. The branch cannot merge until blits publishes
the features it runs on. Delete this once it is all built or turned down.

For whoever picks up weasel's animation work. It answers: how weasel gets a model for combining
several animations on one property, without keeping a second copy of the arithmetic that blits
already has.

## The problem

Two animations writing the same property resolve as last-writer-wins everywhere in weasel, and the
specs that hit this each set it aside:

- **The animator.** Two animations on different `cancelKey`s that write the same pose both run, and
  the one registered later wins each frame. `docs/specs/2026-05-04-animation-primitive-design.md`
  calls a gesture fighting a tween a "sharp edge".
- **Color overrides.** "Multi-override composition… requires a stacking model. v1 is
  last-write-wins." (`docs/superpowers/specs/2026-05-21-animated-vertex-colors-design.md`)
- **Pose overrides.** One entry per node; the last `set` wins, and `usePoseRun` pins any node whose
  entry it didn't write.

The only blending in the kit is the rig's `blendPoses`.

blits (`~/src/blits`, `orochi235/blits`, on npm as `@msb235/blits`) is that combining model. Each voice is an
effect with its own clock and weight, and a mix folds every voice reaching a subject into one value
per frame. The rules belong to the value being written, declared once per channel: `sum`, `mul`,
`max`, `last`, or a channel's own. klieg runs all three of its animation systems on it, and
magicsmoke runs on it too. A second interpolation and easing implementation inside weasel would
drift from it, which is the divergence this proposal removes.

## The proposal

Split the animator into the part that decides what runs and the part that computes values. Hand
the second part to blits, and keep the first.

| Job | Today | After |
|---|---|---|
| Interpolation, easing, keyframe sampling | `useAnimator`, `timeline/sampleTrack.ts`, pose helpers | blits `keys` patches |
| Springs, decay | `physics` in `useAnimator.ts` | blits `spring` and `glide` |
| Combining several writers | None: last writer wins | A blits mix per target |
| Pose overrides, color overrides, camera | Written directly | Each a mix. The paint walk probes it per node; the camera is a mix with one subject |
| `cancelKey` slots and interrupts | Animator | Stays. An interrupt fades the old voice and cues the new one from the current value |
| Timelines, nesting, event tracks, audio booking | Animator | Stays. Cues and seeks voices instead of sampling tracks itself |
| Pause and time scale at three levels | Animator | Stays. Writes the product to each voice's `rate` |
| `watch` / `live` | Animator | Stays, reading voice handles |

What stays has no arithmetic of its own. It acts only by cueing, fading, seeking and re-rating
voices, so there is one implementation of time-to-value, and it is blits'.

**The public surface doesn't change.** `useAnimator`, `tween`, `spring`, `timeline`, `cancelKey`,
the pose helpers and `onTick` keep their signatures and get reimplemented underneath. About 30
source files call the animator: 15 in `packages/core`, 11 site demos, 2 in `packages/d3` and 1 in
`packages/ui`. weasel is published with outside consumers, so this is a rewrite under a stable API,
not a migration. `onTick` keeps working by probing a one-subject mix and handing the value over.

## What blits has to have first

Each of these is blits work.

- **Published on npm.** `@weasel-js/core` can't take a `file:` dependency. Done 2026-09-30:
  `@msb235/blits` 0.1.1, released from a tag with provenance. Pin it exactly.
- **A frozen vocabulary.** weasel's types would follow blits' names. blits renamed across its API
  the week of 2026-09-28. It follows semver from 0.1.1, so a break bumps the minor version, and it
  is still below 1.0. Keeping blits' types out of core's public surface (below) is what makes that
  safe.
- **Fixed-interval stepping.** A stateful patch stepped by the whole gap between samples lands in
  different places at different frame rates: 116.9 at 144 fps against 109.0 at 30 fps, read at
  300 ms. Done: `mix(kit, { stepMs })` runs `step` once per fixed interval.
- **Exact springs and decay, carrying velocity across a retarget.** `spring` and `physics` here
  retarget mid-flight through `setTarget` and `setVelocity`. Done: blits' `spring` and `glide` are
  closed forms per subject; `spring.to` and `push` stand in for `setTarget` and `setVelocity`, and
  start the next stretch from the current position and velocity; `read` returns both, for handing
  motion to another patch. Two limits: each keeps one stretch per subject, so a read earlier than
  the latest retarget does not recall history, and a spring's state is its own, so each is cued on
  one voice.
- **Speed at scene sizes.** Done far enough to build step 3 on: lanes, one-subject voices on flat
  rows, `pull`, and starts and stops that invalidate only their own subject. What is left of the
  gap to today's animator is blits' own per-frame work ("What step 3 built").

## What weasel has to design

- **Interrupts with momentum.** A `cancelKey` interrupt today starts the new animation from the
  live value and drops velocity. On blits it can carry velocity: fade the old voice out over zero
  ms, and start the new spring segment from the old one's position and velocity. This is where the
  velocity hand-off is designed; the reflow glide's known gap ("velocity does not carry over") is
  its first user.
- **Pausing fades.** Writing `rate = 0` pauses a voice's clock, but blits' fades run on the mix
  clock, so a fade in progress keeps going while the voice is paused. A global pause means either
  that blits fades follow voice time, or that the control layer holds the mix clock still and calls
  `rebase()` on resume. The second needs no blits change.
- **Events against mix time.** Event tracks and booking stay in weasel's timeline, but they must
  read the same clock the mix was synced to, or a sound cue drifts against the motion it belongs
  to. The timeline reads time from the mix's `sync` timestamp, not from its own.
- **Channel kits for each target.** Pose: one channel per field, `sum` for translation and rotation
  and `mul` for scale, matching how `resolveSkeleton.compose` already layers rig poses. Color
  overrides are per-vertex arrays, which want a `vec` channel of the right length. Which blend rule
  a vertex color takes is open.

## Decisions this needs

- **Where blits sits — decided 2026-09-30: `@weasel-js/core` depends on it.** One animator, rebuilt
  on blits. blits' types stay out of core's public surface, so a blits rename stays inside core. A
  separate animation package was turned down because core still animates its own camera, which
  would leave two animators. Folding blits into the monorepo as its own `@weasel-js` package is
  still open.
- **`blendPoses` folds into a blits locus — decided 2026-09-30.** A clip crossfade is a locus,
  so rig clips become voices and blend with any other voice on the same joint. Three things to
  settle when it's built:
  - **Rotation** needs a channel of weasel's own whose `lerp` takes the short way round the circle.
    blits' `sum` blends angles in a straight line, so 0.1 and 2π−0.1 would average to π.
  - **Weights adding up to less than 1 follow the locus — decided 2026-09-30.** `[0.3, 0.3]` gives
    an even mix at 60% strength, pulled toward the bind pose, as for every other voice;
    `blendPoses` normalizes it to full strength. Every caller in the tree passes weights summing
    to 1 (`[1 - u, u]`), so nothing visible changes. Only `blendPoses.test.ts`'s `[1, 1]` case
    asserts the old behavior.
  - **Three or more clips:** a locus folds its members a pair at a time, which can differ slightly
    from `blendPoses`' single weighted average once angles take the short way. Test against
    `blendPoses`' own cases before deleting it.

## Order

1. blits: fixed-interval stepping, exact springs with velocity, publish. Done 2026-09-30.
2. weasel: pose overrides as a mix, behind the existing `PoseOverrides` interface, with the reach
   list supplied by the control layer. Benchmark the paint walk before going further. Done
   2026-10-01; see "What step 2 built".
3. weasel: tween, spring and keyframe sampling reimplemented on blits patches under the same
   signatures. Tweens, springs, physics and decay done 2026-10-04; see "What step 3 built".
   Keyframe sampling not started.
4. weasel: `cancelKey` interrupts with momentum; global pause through the mix clock.
5. weasel: color overrides and the camera as mixes.
6. weasel: event tracks reading mix time.

## What step 3 built

`useAnimator` keeps its signatures and its control layer: the table of running animations, keys,
pause and rate, `watch`. Values come from `packages/core/src/animation/engine/codec.ts`, which turns
animator calls into blits voices and blits' columns back into values. Each animation is one blits
voice naming its one subject (`subjects: [id]`); voices share one mix per axis count, and the codec
reads every subject with one `mix.pull` per mix a frame.

- **Tweens.** A value that is a number, a number array or an object of numeric fields, with no
  `interpolate` or `interpolator`, moves in blits as axes. A tween with either option gets eased
  progress from blits and its own function makes the value, since a caller's blend need not be a
  straight line (`interpolateView`, d3's string and color interpolators). A tween of an array or
  numeric object no longer needs an `interpolate`; a value of no usable shape throws when `tween` is
  called, not on a frame.
- **Springs, physics, decay.** Closed forms in blits for the same shapes, so a spring lands in the
  same place at any frame rate. `setTarget` and `setVelocity` retarget and push the subject, and a
  shape that differs from `from` throws. A value of another shape, or constants the closed forms
  cannot solve (damping or mass ≤ 0, stiffness 0 with a target), stays on the old integrator in
  `engine/integrator.ts`.
- **Pause and rate** of one call set its voice's rate; cancel and interrupt drop its voice.
- `engine/blitsContract.test.ts` pins each blits behavior the codec relies on.

**One voice per animation, not grouping — decided 2026-10-03, Mike's call.** The first build grouped
calls onto shared voices by easing or spring constants. Once blits gave one-subject voices shared
flat rows (`2da21c1`), a voice per call read by `pull` cost what a shared voice did, and grouping
was dropped. blits `5a514a3` then made a voice starting or retiring invalidate only its own subject,
where before one start took a 10k frame from about 1 ms to 28–34 ms.

**The cost — accepted 2026-10-04, Mike's call.** Step 3 was approved at about 1.5× today's tween
frame; it costs about 3–3.5× at 10k nodes. `tests/perf/bench/animator-on-blits.bench.ts`, on teitou
(M5 Max, Node 26.10, blits `5a514a3`), today's animator at weasel `014d36366` against this branch,
alternated, two passes with 13–16 of 18 cores free (a third, run with the machine saturated, is
dropped):

| ms per frame                                  | Today       | On blits    |
|-----------------------------------------------|------------:|------------:|
| 10k tweens, steady                            | 0.27 / 0.34 | 1.06 / 0.92 |
| 10k tweens, one stops and one starts a frame  | 0.17 / 0.18 | 1.21 / 1.10 |
| 10k springs, steady                           | 0.82 / 0.69 | 0.62 / 0.63 |
| 1k tweens, steady                             | 0.02 / 0.02 | 0.06 / 0.06 |

Where a 10k tween frame goes, timing the pieces apart on the same machine: blits' `sync` and `pull`
0.27 ms (the same with the codec's shape, any easing, or blits driven raw); reading 10k values back
0.13 ms before they became two field reads (`2b0cf8088`); weasel's own frame loop, ticks,
interpolation and `onTick` 0.21–0.24 ms, close to today's whole frame. The pieces add up to the
total; neither cache eviction nor any interaction between blits and weasel showed in experiments
built to find one. So 1.5× (about 0.3 ms) is out of reach while every animated node goes through
blits each frame: blits' part alone is about today's whole frame.

**Replacing animations makes every later frame dearer, until each has been replaced once.** The
churn row above comes from a short bench run, so it understates what churn costs. Measured on
teitou against blits `eec0b21`, ms per frame in two consecutive 2.5 s windows each:

| 10k tweens, steady frames                       | Today       | On blits    |
|-------------------------------------------------|------------:|------------:|
| as started                                      | 0.19 / 0.19 | 0.53 / 0.54 |
| after every animation was replaced once         | 0.16 / 0.16 | 0.81 / 0.84 |
| started with junk allocated between each start  | 0.40 / 0.42 | 1.05 / 1.05 |

Under continuous churn on blits the frame climbs from 0.85 ms and levels off near 1.08 after about
10k replacements; today's stays near 0.19. What grows in a profile is per-call work: `tick`,
`tickAll`, the caller's `interpolate` and `onTick` each about double, and blits' `writeLater`
triples. The junk row shows that scattering the animations' objects through memory doubles both
animators' frames. Keeping the codec's slots in join order instead of swap-removing was tried, and
was worse.

blits found one cause on its side, voices fading costing its row loop the inlining of each row's
ease, and fixed it in `2ad0063`. What is left is where each animation's objects sit in memory.
The animator's loop over animations reads several objects per animation every frame (its entry,
its `tick` closure and scope, the caller's options and callbacks), and that loop gets slower the
further apart they sit, whoever's code it is. Each `tween()` also cues a blits voice, about 5 KB
of live objects (blits' own figure for a one-subject tween voice), and V8 places an animation's
objects next to whatever else was live when they were promoted out of the young generation: its
own voice. Measured on teitou against blits `2ad0063`, uninstrumented, ms per frame for 10k:

| variant of this branch                                     | as started | fresh, after another churned |
|------------------------------------------------------------|-----------:|-----------------------------:|
| as built                                                   | 0.51–0.59  | 0.82–1.02                    |
| no blits voice cued at all                                 | 0.165      | 0.21–0.22                    |
| no voice, but ~7 KB of junk kept alive per `tween()`       | 0.33       | 0.39                         |
| voices cued together at the next frame, not in `tween()`   | 0.45–0.46  | 0.52–0.53                    |

Without voices the branch costs what today's animator does (0.17–0.19), and junk standing in for
them reproduces the slowdown with no blits involved. Cueing at the next frame keeps a burst of
starts' own objects together and recovers most of it, but not under churn (0.77–0.81 both ways).
Ruled out on the way:
the probe's own objects, reading the eased value from the codec's column, inlining, and garbage
collection time.

Shrinking the voice helps less than its bytes suggest. blits `0c80b6d` takes a one-subject tween
voice from 5.3 KB to 3.7 KB, and the rows move to 0.51 as started, 0.59–0.68 fresh after another
churned, and 0.73 after churn.

Nor does going back to shared voices close it. A prototype cueing one tween voice per easing,
with each call a subject on it, allocates almost nothing in blits per animation, and weasel's
loop still runs 0.23–0.24 ms as started and 0.37–0.49 after churn, against 0.23–0.25 and
0.47–0.50 with a voice per animation (blits' share 0.23–0.27 throughout, ms per frame for 10k,
two runs each). So a voice's footprint explains the bulk-start rows but not churn's: after churn,
weasel's loop is slower whatever blits allocates, and today's animator is not (0.16 after churn
against 0.19 as started). What churn changes on this branch's side is not yet found. Run-to-run
spread on teitou is about ±0.08 ms per frame, so a difference smaller than that needs more runs
than two.

**Before merge:** blits has to publish `tween`, `pull`, per-subject `fade` and the `5a514a3` fixes,
and core's exact pin on `@msb235/blits` moves to that release. Until then the branch runs against a
local build, and the full suite cannot run on the fleet, which installs the pinned 0.2.1.

## What step 2 built

`createPoseOverrides` (`packages/core/src/core/scene/poseOverrides.ts`) keeps its entries table and
adds a mix over `{ pose: last(), alpha: mul() }`. The table is **one voice**, whose patch looks a
node's entry up by id. A voice per node would be quadratic: blits works out which voices reach a
subject by asking every voice, and keeps a record per voice per subject it asked about. The nodes
holding an entry are the reach list; `read` never probes a node outside it.

`PoseOverrides` gained `read(id)`, the folded value, and `get(id)` keeps returning the entry a
writer stored, because writers check that by identity (`reflow.ts`). Everything that paints or
picks reads `read`. Step 3 cues the animator's voices on the same mix, and `read` folds them in.

`tests/perf/bench/pose-overrides.bench.ts` measures one animated frame: mutate every entry, commit,
build the draw commands. Means in ms per frame, two runs each, alternated, on an Apple M2 Max
under Node 26:

| Nodes  | Overridden | Before      | After       |
|-------:|-----------:|------------:|------------:|
|  1,000 |       100% | 0.36 / 0.35 | 0.54 / 0.56 |
| 10,000 |       100% | 4.38 / 3.93 | 7.15 / 6.67 |

With nothing overridden the walk does not change. A probe alone, outside weasel, costs 0.12 µs:
1.2 ms a frame for 10k subjects against 0.15 ms for a `Map` lookup. Garbage collection is about 1%
of its profile. The rest of the walk's added time is an inference, not a measurement: `read` adds a
lookup and a generation check per node. Of the probe's self time, blits' `apply` takes 24%,
`folded` 19% and `Store.get` 14%.

So a select-all drag of 10k nodes spends about 2.7 ms more of a 16.7 ms frame. That is blits'
cost for folding one voice, which the next steps pay as well. Two places it could shrink: a blits
fast path for a subject only one voice reaches, and fewer per-voice lookups in `Store.get`.

Both suggestions, and a stray `workspaces` field in blits' published manifest, are filed in
`NOTES-FROM-WEASEL.md` in the blits repo.

