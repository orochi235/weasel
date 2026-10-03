# The animator on blits

**Status: steps 1 and 2 are built, on branch `pose-overrides-mix`, unmerged; steps 3–6 are not.**
Step 3 waits for dense lanes in blits' `mixer` ("What step 3 has to answer first"). Pose overrides fold through a blits mix, and the paint walk's cost is
measured (below). Nothing animates through blits yet. Delete this once
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

## What step 3 has to answer first

**Decided 2026-10-01: step 3 waits for dense lanes in blits' `mixer`.** Mike's call, relayed from
the blits session. Steps 2 and 3 stay on branch `pose-overrides-mix`, neither merged nor shelved.
When blits has lanes, rerun `animator-on-blits.bench.ts` and `pose-overrides.bench.ts`, which
detect `subjects` on their own, and decide from those.

A lane is a channel `mixer` folds over flat arrays when every voice on it qualifies, falling back
per channel. Lanes are on blits' `main` (`26c9764`, unreleased) and on by default, as is a `tween`
motion form that carries each subject's endpoints and duration as data, so one voice can move every
node. A voice also fades or drops one subject (`handle.fade({ subject, over })`), which covers
weasel handing a node from one animation to another or cancelling it. A call that needs its own
pause or rate still needs its own voice.

Measured there on 2026-10-02 (studio, Node 26, two runs, vitest means in ms per frame), with lanes
off as the same build's control:

| One frame, 10,000 nodes | Today       | One `tween` voice | lanes off   | Voice per call | lanes off   |
|-------------------------|------------:|------------------:|------------:|---------------:|------------:|
| tween                   | 0.42 / 0.44 |       2.11 / 1.99 | 2.64 / 2.68 |    3.76 / 3.92 | 3.80 / 4.19 |

| One frame, 10,000 nodes | Today       | One `spring` voice | lanes off   | Voice per call | lanes off   |
|-------------------------|------------:|-------------------:|------------:|---------------:|------------:|
| spring                  | 0.67 / 0.94 |        2.45 / 2.48 | 2.68 / 2.77 |    4.64 / 4.70 | 6.07 / 6.03 |

One shared voice halves a voice per call and is still about 5× today's frame. An `fn` patch on one
voice measures the same as the `tween` form, 2.07 / 2.06.

Lanes alone will not reach today's animator. A `probe` costs 110–140 ns at 10k subjects even when a
lane has done the arithmetic, so a paint walk probing every node pays 1.1–1.4 ms before any
interpolation, above today's whole tween frame. blits' spike had measured this workload in a dense
loop at 0.02–0.34 ms for 10k nodes, but those figures fill arrays and never read a pose back.

The bulk read exists: `mix.pull(subjects, { pos: Float64Array })` writes every subject's pose into
arrays in one call. Since blits `93f0317` it skips each subject's lookup when handed the same array
as last frame, and since `a00754e` it fills a motion lane in one loop and copies it out a column at
a time. Alternated with `93f0317` over five pairs on studio, the shared `tween` voice read by `pull`
at 10k went from a median 1.34 ms to 0.94, against today's 0.31–0.40 on the quieter runs: about
2.5–3× today's frame, or 95 ns a node against 35.
Step 2's paint walk runs through the same per-node probe, so it would gain from `pull` too.

Starting one `tween` voice over 10k nodes and computing its first frame costs about twice an `fn`
voice in plain node (about 35 ms against 16 warm); the bench's start row reads 85–93 against 11–12,
which garbage collection inside its eight timed iterations likely inflates.

The measurements behind the decision:
`tests/perf/bench/animator-on-blits.bench.ts` animates N nodes' `{ x, y }` three ways: today's
animator, one tween or spring per node; one blits voice per call, naming its node in `subjects`;
and one voice for every node, reading each node's endpoints. Each row checks it computes today's
values before it is timed.

Medians in ms, two runs each, alternated, on an Apple M2 Max under Node 26 with the machine loaded
(load average 11–23), against blits' unreleased `project` branch as of 2026-10-01:

| One frame | Nodes  | Today       | Voice per call | One voice   |
|-----------|-------:|------------:|---------------:|------------:|
| tween     |  1,000 | 0.03 / 0.04 |    0.20 / 0.19 | 0.14 / 0.15 |
| tween     | 10,000 | 0.31 / 0.28 |    3.92 / 3.57 | 1.79 / 1.84 |
| spring    |  1,000 | 0.04 / 0.05 |    0.32 / 0.36 | 0.30 / 0.30 |
| spring    | 10,000 | 0.46 / 0.51 |    6.87 / 6.61 | 4.14 / 4.49 |

| Start, and first frame | Nodes  | Today       | Voice per call |
|------------------------|-------:|------------:|---------------:|
| tween                  |  1,000 | 0.71 / 0.87 |      3.7 / 2.8 |
| tween                  | 10,000 |   6.3 / 6.3 |        58 / 42 |
| spring                 | 10,000 | 10.3 / 10.1 |        96 / 34 |

Today's start rows include mounting the hook, and some of their runs hit 25–100 ms outliers; the
table quotes the runs without them.

A voice per call is the animator's API ported as it stands, so that is the cost step 3 pays as
written: about 3.5 ms a frame for 10k tweens and 6.5 ms for 10k springs, against 0.3 and 0.5 today.
Before `subjects`, a voice reached its node through a `target` predicate blits asked of every
subject, and starting 1,000 took about a second; `subjects` removed that, and the release with it
is pending.

blits does not expect `mixer` to get much faster for one voice: an exact fast path measured no
gain. Its `spikes/gpu-engine` measured a dense CPU engine at 0.37 ms for 10k subjects where `mixer`
took 6.8, but that engine is not built, computes every subject whether or not anything reads it,
and has not been tried on springs. Lanes inside `mixer` are the form that work takes.

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

