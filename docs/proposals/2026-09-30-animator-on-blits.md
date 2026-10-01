# The animator on blits

**Status: steps 1 and 2 are built; steps 3–6 are not.** Pose overrides fold through a blits mix,
and the paint walk's cost is measured (below). Nothing animates through blits yet. Delete this once
it is built or turned down.

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
- **Speed at scene sizes.** One run of blits' `npm run bench` on 2026-09-30 read 27.8 ms per frame
  for 10k subjects × 3 `fn` voices. The same day, builds from before and after blits' reach change
  were alternated four times on that row and read 6.0–7.6 ms each, so the 27.8 was a loaded
  machine. That is still a third to a half of a 60 Hz frame for 10k nodes before painting. The paint walk would probe only the nodes some voice
  reaches. blits now walks only the voices that reach a subject (`1b1d841`), but nothing yet lists
  which subjects any voice reaches. weasel supplies that list, as step 2 measured
  below.

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
   signatures.
4. weasel: `cancelKey` interrupts with momentum; global pause through the mix clock.
5. weasel: color overrides and the camera as mixes.
6. weasel: event tracks reading mix time.

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

`@msb235/blits` 0.2.1's published manifest still carries `"workspaces": ["site"]`, which is blits'
own dev setup leaking into the package. It does no harm in weasel's install, but blits should drop
it from what it publishes.

