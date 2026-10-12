# The animator on blits

**Status: the values are computed in blits, and pose animation is on targets.** Built and merged: pose overrides
fold through a mix, tweens, springs, physics, decay, and keyframe sampling compute in blits ("What
step 3 built"), on `@msb235/blits` 0.8.1, and a global pause holds the mix clock. Animation targets
are built, and the pose helpers, reflow, and momentum move them, so two moves on one node combine.
Not built: the last three arcs under "The arcs" (color and camera, timeline, rig). Delete this
once they are all built or turned down.

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

## How animations combine

Decided 2026-10-11, Mike's calls. As built through step 3, every animation is its own blits subject
and hands its value to the caller's `onTick`, so the later writer still wins. What changes that:

- **A target** is one animatable value whose owner says how to read and set the committed value,
  what shows when nothing is animating. `tween`, `spring`, `physics`, and `decay` take a `target`
  in place of `onTick`. It is public engine surface; the pose, color, and camera helpers are
  callers of it.
- **Offset voices add.** An animation given a target commits its destination when it starts and
  contributes only what is left to travel. Overlapping offsets sum, so an interrupt keeps its
  speed and nothing cancels anything. A crossfade between absolute values was turned down: every
  overlap would need a fade time, and speed would kink where the fade starts.
- **Absolute voices stand in for the committed value**: a timeline's sampled track, a rig clip, a
  held override such as a drag preview. Several crossfade through a blits locus. What is on
  screen is the absolute value if there is one, else the committed value, plus every offset.
- **Two shapes of target.** One its reader probes when it needs the value (pose, vertex colors),
  and one that pushes its folded value to a setter once a frame (the camera, a consumer's own).
- **The camera keeps its destination to itself** and writes the folded view through `view.set`
  each frame, so `view.get()` and pointer math read the live view. Animations from one
  `useViewAnimation` instance go on replacing each other, since two anchored zooms do not add.
- **The same `cancelKey` still replaces**, unless the animation passes `interrupt: false`.
  `tweenPose` does, so successive moves on one node blend under one key.

## Decisions this needs

- **Where blits sits — decided 2026-09-30: `@weasel-js/core` depends on it.** One animator, rebuilt
  on blits. blits' types stay out of core's public surface, so a blits rename stays inside core. A
  separate animation package was turned down because core still animates its own camera, which
  would leave two animators. Folding blits into the monorepo as its own `@weasel-js` package is
  still open.
- **`blendPoses` folds into a blits locus — decided 2026-09-30, built 2026-10-11.** A clip
  crossfade is a locus, so rig clips are holds on the rig's target and blend with any other voice
  on it. `blendPoses` is deleted; its test cases run against holds in `rig/poseHolds.test.tsx`.
  What was settled:
  - **Rotation** got no channel of its own. A hold answers its value less the committed one, and
    that difference is taken the short way round on an angle axis, so 0.1 and 2π−0.1 held at
    half weight each show 0. The short way is measured from the committed pose, not between the
    holds: 3 and −3 held over a bind pose at 0 meet at 0, where `blendPoses` met at π. Two clips
    differ from `blendPoses` only where a joint's two rotations are more than half a turn apart
    going through the committed pose's. Fading one clip in over the committed pose is always the short way.
    A result lands on the committed pose's turn, where `blendPoses` kept the first pose's.
  - **Weights adding up to less than 1 follow the locus — decided 2026-09-30.** `[0.3, 0.3]` gives
    an even mix at 60% strength, pulled toward the committed pose, which for a rig nobody has
    posed is the bind pose. `[1, 1]` is still an even mix.
  - **Three or more clips** fold to their weighted sum, in any order: each is a difference from
    the committed pose before blits sees it, so no fold takes a short way of its own.
  - A pose read back from a target names every joint of the skeleton in full, where `blendPoses`
    named only the joints its inputs did.

## The arcs

Each is its own spec, plan, and merge, in this order. The first three steps of the original order
are built: blits' stepping and springs, pose overrides as a mix, and values computed on blits.

1. **Targets.** Built 2026-10-11: `createTarget` (`packages/core/src/animation/target.ts`), and
   `target` on `tween`, `spring`, `physics`, and `decay`. Each animation on a target is a voice
   on the target as its blits subject, so the codec's `pull` reads their sum. A coast has no
   destination, so it commits where it stops, not a landing point up front. Offsets live in the
   animator that cued them, and a second animator cueing onto a moving target throws.
   Cost, one pass of `tests/perf/bench/animator-on-blits.bench.ts` on teitou (Node 24.21.0,
   blits 0.8.1, 14 of 18 cores free), mean ms per frame for 10k tweens: 0.53 through `onTick`
   storing each value, 1.50 on 10k targets with `target.read()` called per node after the
   frame. Where the difference goes was not profiled; `read` builds an axes array and a value
   object per call.
2. **Pose.** Built 2026-10-11. `createPoseTarget` (`packages/core/src/animation/poseTarget.ts`)
   is a target whose `show` publishes the folded pose as the node's override entry while it
   moves and clears it at rest; `scenePoseTarget` keeps one per scene node, and an adapter hands
   it out through `poseTarget`. `tweenPose`, `springPose`, the two wrappers, reflow, and momentum
   move it. Decided:
   - A move commits its destination to the scene as it starts, unrecorded; the helper records
     its one transform op first. Nothing writes `setPose` per frame.
   - `tweenPose` keeps `pose:<id>` and takes it with `interrupt: false`, so successive moves
     add. `springPose` interrupts under that key at the summed velocity of what it interrupts.
   - A reflow glide's target commits the slot the layout wants, held by the reflow module, not
     the document pose. A spring retarget carries velocity.
   - A momentum coast is a targeted decay per node, from the release pose, and the flick is
     recorded once every node has stopped.
   - An adapter with no `poseTarget`, a pose with no axes, and a container under
     `cascadeContainerPose` keep the write-a-frame path.
   - Something else writing the node's pose mid-flight (an undo) wins: at the next frame the
     scene's target stops its animations without committing (`target.stop({ commit: false })`),
     so the node shows what was written. Only `scenePoseTarget` watches for it; a target made
     with `createPoseTarget` or `createTarget` calls `stop` itself.
3. **Color and camera.** Built 2026-10-11.
   - **Camera.** `useViewAnimationOn` makes one target for its view and exposes it as
     `viewTarget`. The committed view lives in the hook while anything is in flight, and the
     target's `show` writes the folded view through the channel, so `view.get()` stays live. The
     hook's own animations still replace each other under its key. An outside write cancels the
     hook's animation and drops the committed view, so anything else on the target carries on
     over what the writer wrote, less the offset it was showing when the writer read the view.
     `<SceneCanvas>` does not expose the target: its camera animator is private, and a target
     is no use without the animator that moves it.
   - **Color.** `ColorOverrideRegistry.target(id, channel, length)` is one target per node and
     channel, with its committed colors held in the registry. `tweenVertexColors` and
     `staggerVertexColors` share a key with `interrupt: false` and add; `springVertexColors`
     interrupts and carries velocity, springing each number on its own. `resolve` answers the
     target's colors where `set` stored nothing, and over a `set` override it adds only the
     target's live offset. A finished animation releases its colors; a canceled one holds them
     until `clear`.
   - **`interrupt: false`** on a targeted animation joins its `cancelKey` without canceling the
     holders.
4. **Timeline.** Built 2026-10-11. An absolute voice is a *hold*: a voice on the target's own
   subject, beside its offsets, answering the held value less the committed one, and cued into
   one locus shared by every hold (`engine/holds.ts`). Holds on a target so fold as alternatives,
   offsets add on top, and weights short of 1 leave the rest to the committed value.
   `animator.hold({ target, value, weight? })` is the public form, for a drag preview or a value
   driven from outside; a hold of plain values asks for no frames. A sampled track takes `target`
   and `weight`, and is a hold while the playhead is within its keys
   (`timeline/trackHolds.ts`). Decided along the way:
   - A hold that leaves commits what keeps the screen still: its own value where it was alone
     at full weight, and otherwise the committed value solved for against the holds that stay.
     Where those cover the target outright, it commits its own value and the screen follows
     them. `release({ commit: false })` falls back to the committed value instead.
   - A track commits its last key once the playhead is past it, stepped over or not, and lets
     the target go; before its first key it leaves the target alone.
   - The timeline samples in its tick, after the frame's pull, so it touches the subject and the
     animator reads touched subjects again before `show`. A seek or a loop seam shows that frame.
     blits keeps a patch's answer while its clock stands still, so the codec touches every held
     subject ahead of each pull too.
   - An animation's clock is seeded from the frame clock where one is running, as its voice is,
     so an event at time E and a tween of length E started between frames land on one frame.
     Booking reads that same clock through the timeline's tick and needed no change.
   - An offset canceled under a full-weight hold commits what it had left, but the hold stands
     in front of the committed value, so the screen loses that much.
5. **Rig.** Built 2026-10-11. A bound rig is a target, `Rig.target` (`rig/bindRig.ts`): its
   committed value starts at the bind pose and its `show` poses the bound nodes. Its axes are
   `skeletonAxes(skeleton)`, five a joint with every rotation an angle, exported for a pose target
   bound to no nodes. A clip is a `SampledTrack<Pose>` naming the target, so clips crossfade by
   `weight` and a spring or tween adds on top, and nothing in the fold is the rig's own.
   `blendPoses` is deleted ("Decisions this needs"). Decided along the way:
   - A track with a `target` and no `interpolate` is sampled in the target's axes, an angle axis
     the short way from the key before (`timeline/targetStops.ts`). That was the one job a pose
     track's `interpolate` had.
   - `rig.pose(pose, root)` is still a direct write, and commits `pose`. `rig.place(root)` sets
     the placement with no pose, and a `pose` given no `root` keeps the last one. A hold of plain
     values under a `pose` weighs the new pose in when the hold is next read.
   - IK weighs against animation as a hold of the solved pose at `w`, beside the clip at `1 - w`.
     A hold covers every joint, so there is no holding part of a rig: an arm solved at full
     strength over a body on other holds starts from the body as one pose, which the rig demo
     samples from a track. A hold over some joints only is not built.
   - The platformer's clips are tracks on one pose target, and its cross-fade is the target's
     arithmetic: canceling the outgoing clip's timeline commits the pose on screen, and the next
     clip fades in over it by weight. Its simulation seeks each clip, and a seek shows at the
     next frame, so joint angles run one frame behind the body's position.
   - A frame the animator asks for from inside its own ticks now waits until after `onTick`. Asked
     for from a tick (a track taking hold of its target, an `onDone` starting an animation), it
     ran ahead of the paint a canvas requests from `onTick`, and the tick after painted nothing.

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
- **Keyframe sampling.** `sampleTrack` builds a track's keys into a blits `keys` patch once per
  `segmentCache`, so `timeline.edit`'s cache drop is still the one invalidation, and reads it at
  the playhead's phase. Number arrays and numeric objects lerp without an `interpolate`; a track
  with `interpolate` or `interpolator` gets its segment and easing from blits and makes the value
  itself, as a tween does. Sampling exactly at a key's time returns that key's value, the later of
  two sharing a time, where blits would return the earlier and reach an interior key as
  `a + (b - a) * ease(1)`.

  Sampling itself cues no voice: the timeline keeps its own clock for seek, loops and nesting,
  and samples at its playhead. Since arc 4 a track given a `target` shows that sample through a
  hold on the target, read again the same frame ("The arcs").

  `tests/perf/bench/timeline-sampling.bench.ts`, teitou (M5 Max, Node 26.10.0), blits 0.7.0,
  four-key tracks each sampled once a frame, mean ms per frame over three passes (the 1.04 is one
  pass's outlier, left in):

  | Tracks | Today                    | On blits                 |
  |-------:|-------------------------:|-------------------------:|
  |    100 | 0.0014 / 0.0014 / 0.0014 | 0.0042 / 0.0041 / 0.0040 |
  |  1,000 | 0.0154 / 0.0157 / 0.0174 | 0.0527 / 0.0466 / 0.0550 |
  | 10,000 | 0.1842 / 0.1996 / 0.1887 | 0.4722 / 0.4863 / 1.0391 |

  About 2.5–3.5× today's frame. Profiled in plain node at 10k tracks, today's sampler takes
  0.058–0.076 ms a frame and blits' `patch.at` alone 0.33–0.40: its fresh result object, the
  generic path in its `read`, and a search three times a plain binary search's cost. That is
  blits' read path, filed in blits' `NOTES-FROM-WEASEL.md`. weasel's own share, a `WeakMap`
  lookup per sample, is gone.

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
against 0.19 as started). Run-to-run spread on teitou is about ±0.08 ms per frame, so a
difference smaller than that needs more runs than two.

Nor does keeping weasel's own per-animation objects out of the loop. Branch `animator-pool`
(`6a3a61246`) ticks tweens from flat tables: clocks, pause, rate and what a tween reads live in
typed arrays and dense arrays in registration order, the codec mirrors each subject's `cols` and
`at` by a reused index instead of handing out a per-start reader, and tweens of one shape share
one `Axes`. The loop then touches no object weasel allocated per animation, only the caller's own
`onTick`, `from` and `to`. Same harness, same tree on teitou, the two builds alternated over six
rounds (three for the split), each row redone while other processes used more than half a core;
ms per frame for 10k tweens, median (min–max):

| 10k tweens, ms per frame      | as built         | flat tables      |
|-------------------------------|------------------|------------------|
| as started                    | 0.50 (0.48–0.60) | 0.58 (0.57–0.59) |
| fresh, after another churned  | 0.53 (0.52–0.58) | 0.63 (0.61–0.68) |
| after churn                   | 0.67 (0.66–0.83) | 0.63 (0.61–0.73) |
| weasel's loop, as started     | 0.26 (0.25–0.27) | 0.33 (0.33–0.34) |
| weasel's loop, after churn    | 0.42 (0.42–0.43) | 0.37 (0.36–0.38) |

blits' share is 0.22–0.25 in every row of both. The flat tables take most of the churn penalty
away (after churn costs what fresh does), but at a higher floor: the loop is 0.07 ms slower as
started and 0.13 slower fresh, and no row gets near the 0.165 measured with no voices. So the
per-animation objects weasel allocates are not what keeps the loop at two to three times today's
cost.

**What churn costs is what each voice keeps alive, and nothing else.** Measured 2026-10-05 on
teitou against blits 0.4.0, the codec's tween tick computing its own easing so the loop reads no
codec record, after every animation was replaced once, weasel's loop alone in ms per frame for 10k
tweens, three alternated rounds:

| after churn                                         | voice per animation | no voice cued     |
|-----------------------------------------------------|--------------------:|------------------:|
| caller's objects made at each restart               | 0.75 / 0.66 / 0.69  | 0.22 / 0.21 / 0.21 |
| caller's objects made in one burst before the churn | 0.41 / 0.40 / 0.65  | 0.21 / 0.21 / 0.21 |

With no voice, churn costs nothing: 0.21 is the loop's steady figure. With voices, about half the
penalty is the caller's objects landing a voice apart and the rest weasel's own. Reading the
eased value from the codec record rather than computing it adds at most 0.05 ms in any state.
A one-subject tween voice keeps about 3.2 KB alive on 0.4.0 (Node, `heapUsed` over 10k): its
patch 0.8 KB, `cue` 1.6 KB, its first frame 0.75 KB. A tween patch can be shared across voices,
each tween's `from`, `to` and `ms` read per subject, which drops the patch's share, but shrinking
a voice by a third (`0c80b6d`) barely moved these rows. What would remove the penalty is blits
reusing a retired voice's records for the next cue, so a steady churn allocates nothing that
survives. That is filed with blits.

**Built:** the codec cues tweens together at the start of the next `frame`, not one by one in
`tween()`, before the clock advances, so a tween starts at the same time either way. Teitou, blits
`0c80b6d`, the two codecs swapped in one tree over six alternating rounds, ms per frame for 10k
tweens, median (min–max): as started 0.49 (0.47–0.50) before, 0.45 (0.41–0.45) after; fresh after
another churned 0.55 (0.51–0.65), 0.44 (0.44–0.52); after churn 0.67 (0.63–0.68), 0.69
(0.66–1.03), no change. Springs still cue in `spring()`.

## What step 2 built

`createPoseOverrides` (`packages/core/src/core/scene/poseOverrides.ts`) keeps its entries table and
adds a mix over `{ pose: last(), alpha: mul() }`. The table is **one voice**, whose patch looks a
node's entry up by id. A voice per node would be quadratic: blits works out which voices reach a
subject by asking every voice, and keeps a record per voice per subject it asked about. The nodes
holding an entry are the reach list; `read` never probes a node outside it.

`PoseOverrides` gained `read(id)`, the folded value, and `get(id)` keeps returning the entry a
writer stored, because writers check that by identity (`reflow.ts`). Everything that paints or
picks reads `read`. The entries table is still this mix's only voice.

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

