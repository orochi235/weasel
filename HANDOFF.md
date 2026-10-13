# Handoff: weasel main (2026-10-11)

For the session picking this up. It says what state `main` is in, what is next, and what was
decided in conversation that the code does not say. Open work lives in `docs/TODO.md`.

## State

Everything below is on `main`. Other sessions commit to this checkout too. Stage explicit paths,
never `git add -A`.

## The third TODO pass, 2026-10-11 afternoon

Nine agents, one per `docs/TODO.md` section, fixed entries test-first and committed on `main`; the
TODO went from 60 P2 and 236 P3 entries to 32 and 178. What the log does not say:

- **Behavior and API changes made on an agent's judgment, none ruled on.** Each is one commit with a
  changeset that says so; `git log e748d978a.. --grep` on the name finds it.
  - Input: keys and paste go only to the canvas last pressed or scrolled in (ruled; `claimKeys`
    takes them on mount, and every single-canvas demo's shortcuts are dead until a click).
    `useHoverTracking`, `useLassoTool`, `usePenTool`, and `TargetPredicate` changed signature;
    `ContributionsApi.scopedBindings()` is gone; a mode-barred tool stops drawing its overlay.
  - Scene and move: a node with `derivePose` and a `dependsOn` list hands a drag to its
    dependencies, engine-wide; a `momentum` coast is pose overrides until it rests (`MoveAdapter`
    gained `previewPoses`), and an undo mid-coast stops it only if it moves that node; `Scene`
    gained a required `mintId` and ids lost their `paste-`/`pn-`/`kit-` prefixes; paste drops a
    derived node whose function is unregistered.
  - Rendering: `GlMat3` is `Float32Array | Float64Array`; `PathDrawCommand` takes `CommandFill` /
    `CommandStroke` only; `RectPose.transform` applies to any box pose, and the selection chrome,
    resize, rotate, and text overlay do not honor it yet.
  - Text: `BidiResolver.baseLevel` is required; an omitted `direction` is `'auto'`.
  - Prefs: stored records are `{ $at, value }` (ruled), so an older build reads a stamped store as
    defaults, astv's included once it reads a rebuilt `dist`; `label` and `separator` are
    `PrefKind`s now, which reverses the call recorded under "Decided in conversation".
  - Theme: `applyTheme` returns a release. Timeline handles need `subscribePlayback`.
    `isPlainObject` rejects class instances in theme, prefs, labkit, and forge.
  - Diagram: groups nest and their boxes take presses; the `orthogonal` router turns at once after
    a waypoint where it would double back.
  - Animation and audio: `UseAnimatorOptions.setTimer`/`clearTimer` are gone; audio has `onDrop`.
- **Not seen in a browser:** everything in this pass. Most at risk: the `u_origin` shader path for
  large translations, the `a_position` pin, skewed text and images, the theme editor's dead-draft
  screen, draw's grid and snap buttons, the site's source tabs, a label row in `PrefsForm`, and the
  selection chrome on a dragged diagram group.
- **Never run:** the pull request benchmark workflow; `check:treeshake` and the consumer smoke test
  against the split core barrel (`src/barrel/`, where a new core export now goes).
- **Left by the agents as open questions in `docs/TODO.md`:** what a partial duplicate does to a
  copied edge, `mod` in the route-conflict check, the Align bar under an omitted direction, a tab in
  the canvas-2D label paths, and `check:spacing` outside `packages/ui`.

## The whole-repo read for bugs, 2026-10-11

Twenty read-only passes covered every package and app, and a fix pass per report followed: about 285
findings fixed, each with a test that failed first, 123 filed in `docs/TODO.md` (202 entries with the
remainders of fixes), and 6 refuted. `git log 3914006e5..` and `.changeset/` are the record.

What a later session cannot get from the log:

- **Behavior changes made on an agent's judgment, each reversible, none ruled on.** Draw: a double-click
  on a path inside an isolated group leaves isolation for path edit; Open adopts the file's background
  color. Pen: Enter on one anchor, or a double-click from idle, discards the stub. Dispatcher:
  `subscribe` no longer fires for input with no gesture in flight, and a throwing `onEnd` is logged, not
  thrown. `MultiTouchEvent` gained an optional `end`. History: a broken undo entry now throws every time
  and stays on the stack (filed P2). `loadState` throws inside `batch` or `untracked`. `CurveEditor`
  draws `value` whenever no anchor is held, so a consumer must write `onInput` back. SVG import drops
  hidden content, and `pathFromD` stops at a malformed command. `RecordCache.set(name, undefined)` is a
  delete for every consumer.
- **Confirmed and filed, not fixed, because each is a design call:** right-to-left text lays out reversed
  in text nodes (text must not depend on bidi; three options are in the entry); a translucent bitmap is
  multiplied by its alpha twice; `SelectionPanel` draws an unset `pose.rotation` as blank (default
  substitution was removed on purpose in `cd9b75632`); `mod` is drawn as ⌘ on every platform; a
  container, child, and grandchild moved in one batch undo to 0, 95, and 190.
- **Not seen in a browser:** forge's two hot-update fixes (server side only; needs
  `WAKE_PATH=/nonexistent`), labkit's surface ghost and wheel-over-mark fixes, the toast hover and held
  stepper fixes, and `MultiSelectDemo`'s corner resize. Seen in headless Chromium: draw's preferences
  modal with `rowsAcross={2}`, `ControlPanel`'s nested and presentation stories, `SelectionPanel`'s
  shape story, draw's color keys and text tool, and the multi-select and point-snap demos.
- **Two bugs belong to `~/src/wake`** and are filed under forge in `docs/TODO.md`: a reload about three
  seconds after every hot update, and the exit-time release writing the registry without the lock.

## Next

1. Rule on the behavior changes above. The open either/ors in `docs/TODO.md` were ruled on 2026-10-11
   (`grep 'Ruled 2026-10-11' docs/TODO.md`); each ruled entry says what work it leaves. Still open: the
   new word for the `features` directory, the second cue for disabled controls, and the labkit schema
   conditions entry (P1.5, deferred). A second pass also settled some either/ors on an agent's
   judgment, each one commit: `9dfd8a5aa`, `d3635ee3f`, `87f162fec`, `e023a51e7`, `d16306d2e`,
   `cf170b8ea`, `3dff419d8`, and `8261c9c44`.
2. The Changes pane's Submit button is built: `onSubmit(changes, literal)` on `PrefSchemaEditor`. astv's
   session wires the host half (a dev-server route that appends to a file the agent watches).
3. astv's server-backed prefs adapter resends refused writes itself, to get around a record cache
   bug that is now fixed here; it can drop that once it reads the rebuilt `dist`.

## Decided in conversation, not in the code

- **The editor's tree has no General branch; a root's loose nodes are listed under Unplaced.**
  `8c830675d` made it so, and it was confirmed on 2026-10-11 over an earlier call that kept General
  distinct from Unplaced.
- **"The treeview" that lost 40px** was read as the prefs dialog's rail (176px, was 216px), because
  the editor's structure tree already resized. Mike did not confirm that reading.
- **Two-column rows keep the label beside the control and wrap per row only when it does not fit.**
  Stacking every label over its control was tried first and rejected.
- **Prefs dialog width:** capped at 900px, settles at 800px, and the editor's preview starts at 800px.
  A 600px cap was tried and withdrawn.
- **A label was a leaf of kind `label` that only the UI knew.** The third TODO pass made `label` and
  `separator` `PrefKind`s in `@weasel-js/prefs` (`cce05ca5f`). Neither call has been ruled on.
- **`as: 'page'` draws as the default wherever there is no rail.**

## Traps met here

- **astv reads these packages' built `dist`.** `npm run weasel:watch`, run from `~/src/astv`, rebuilds
  core, ui, and labkit's stylesheet only. A change in `packages/prefs` or in labkit's source needs
  `npm run build` in that package, and labkit's build empties `dist` first, blanking astv's page until
  it finishes. This session started that watcher; check `pgrep -fl weasel-watch` before starting one.
- **astv keeps its own copy of the stamped-record reader.** Its server reads `cache.maxGB` and
  `cache.dir` without `@weasel-js/prefs`, through `recordValueOf` in astv's
  `packages/model/prefRecords.ts` (astv `f8f07c5d`). If the `{ $at, value }` shape changes, that copy
  has to follow.
- **`ui/src/components/Tabs` already exists** (react-aria `Tabs`, `TabList`, `Tab`, `TabPanel`).
  `ls | grep '^Tab'` on a long listing misses it. `GroupTabs` in `components/Prefs` is the one tab
  strip every schema surface uses.
- **astv's schema page** is `http://localhost:<astv app port>/prefs-schema.html`; it was the page
  used for every browser check, and Mike watches it.

## Carried from the 2026-10-07 handoff, not re-checked

Check each against the tree before quoting it.

- **Waiting on Mike then:** the mesh batching cap (256 was too high for meshes drawn back to back
  and too low for meshes mixed with rects) and per-layer render-to-texture; both have TODO entries.
- **Merged on an agent's judgment then, each reversible:** `{ px }` dashes are screen pixels;
  `NodeInk.outsetPx`/`insetPx` and `ClipFromPoseFn` are exports; `@weasel-js/ui` depends on
  `@weasel-js/react`; `react-hooks/set-state-in-effect` is on; callback types are bivariant;
  `gestureViewReader` and `gesturePlaneReader` type their `view`; `FEATURE_ACTION_IDS` lost its
  `pick` and `transform` keys.
- **Design calls left in `docs/TODO.md` then:** tile-grid scrolling state, SVG export of wrapped
  text, container sizes for `@container`, trial tiles under 300px, the preview channel's data field,
  a derived node read through a bare adapter, what a derivation's pull may read, whether
  `targetConsultsAffordance` should infer, handle sizes, promoting `ShaderDrawCommand`, whether
  benchmarks gate CI, and whether routing should declare the `activeTool` dep.

## Animation targets (the blits migration), 2026-10-11 night

For the session picking animation up. The entries the evening left under "Combining animations"
in `docs/TODO.md` are built, and so is what the evening's handoff listed beside them. All of it
is on `main` as of `ad8a2f09d`; `docs/concepts.md` ("Animation target") describes it and
`.changeset/` says what changed for a consumer. A fleet run of the merge was green.

**Mike's "ok work through the open issues" (2026-10-11): all four are built.** The animator
is `packages/animator/src/` (tests under the `weasel-ui` vitest project).

- On `main`: vertex colors as rows of a target table, and the cost of stopping and starting
  an animation measured in parts (`node tests/perf/target-reads/run.mjs churn`); nearly all of
  that is blits', written up in `~/src/blits/NOTES-FROM-WEASEL.md` (blits `14c49b2`, unpushed).
- Also on `main`, merged at `f9465b6a2` on top of weasel-71's `hold-behind` and
  `spring-two-voices`: the target book clears only the targets whose animations changed since
  the last frame, and a table row with a hold is shown by the table's pass. The branch's
  fleet run failed three browser tests on timeouts (`LabLightbox`, `Lightbox`,
  `overlayAlignment`), which pass alone.
- 2026-10-12, on `main` at `3adb0d9d3`: a hold builds one array a frame where it built
  eight, a third off its cost. What is left of a hold's cost is in the
  TODO ("A hold costs"), with two designs. The larger, holds kept as rows of a target table's
  arrays, adds public API to the table and waits on Mike for its shape.

**What is left**, all under "Combining animations" in `docs/TODO.md`:

1. Reads are solved for many values: `createTargetTable` (`da782a556`) shows a moving row in 3
   to 4 ns where a target apiece costs about 140. The TODO has what it leaves (nothing in the
   kit is on one yet; rows with a hold take the slow path) and two costs its measurements
   turned up that are not the table's: a frame's own cost per animation, and what stopping
   and starting one costs. `node tests/perf/target-reads/run.mjs` re-derives all of it.
2. A hold covers the move a destination makes in the committed value, as of `790609846`
   (`docs/concepts.md`, "Animation target"); Mike said to build the recommended option. A
   spring on a target runs as up to two voices (`engine/springVoices.ts`, `9c526ca33`), so the
   hold covers only its move. Two calls made on the way, in the changeset and not ruled: a
   hold released with a commit takes the share it covered of each move with it, and a spring's
   `setTarget(null)` commits where the spring had brought the value.
3. A time scale below 0 is refused where it is set (`9c526ca33`). Playing backward is a P3.

Mike ruled on 2026-10-11 that blits stays in its own repo; do not re-propose moving it into the
monorepo.

**Decided in conversation, not in the code:**

- Mike chose targets that fold over the narrower "steps as written" (2026-10-11), and additive
  offsets over a crossfade between absolute values. Do not re-propose a crossfade.
- Calls made on the go-ahead "knock off those 8 new entries, and then any other unfinished blits
  migration business", which he has seen in a report and not ruled on:
  - A coast a `tweenPose` takes over hands the distance it had traveled to a spring, under
    `pose:<id>`. It does not keep coasting on top of the tween.
  - An offset canceled under a hold stays on screen beside the hold, and is committed as the
    target's last hold leaves. `target.stop({ commit: false })` drops it.
  - Holds on an angle axis meet at their average direction by weight. This was done in
    `engine/holds.ts`, with no blits change.
  - A target's holds reach blits as one voice, folded in `engine/holds.ts`, because a hold can
    cover some axes (`HoldOptions.axes`) and blits weighs a voice whole. weasel no longer uses
    blits' `locus` or voice `weight`.
  - `arrayAdapter` holds the pose on screen while a node moves; an outside write to a moving
    node there is overwritten at the next frame, as before.
  - A container under `cascadeContainerPose` moves on its target, and stops any move a
    descendant had of its own, as the per-frame write did.
  - `seek` and `edit` on a timeline sample their tracks at once, so a track's `onTick` is called
    from them too.
  - `SceneCanvasApi.camera` hands out the canvas's private camera animator.
  - A target table's rows run in a blits mix of the table's own, apart from other targets
    with as many axes, so the lane can keep each row's index beside its columns.
- The earlier calls, also unruled: a coast commits where it stops; `from` defaults to the
  committed value; an outside write to a moving node's pose wins and stops the move;
  `sceneToAdapter.getPose` answers the pose on screen mid-flight while `scene.get(id).pose` holds
  the destination; `tweenPose` joins its key so successive moves add, and `springPose`
  interrupts at their summed velocity.
- The costs of moving values onto blits were accepted by Mike on 2026-10-04 and 2026-10-08.

**Traps met here:**

- A target is shown as an animation starts on it, not only on frames. A test counting `show`
  calls or `view.set` writes has to count that one.
- A target is moved by one animator at a time; a second throws.
- Run `npm run check:size` before every commit. Three commits here grew a file past its entry
  and were caught only by the gate. `--update` rewrites other sessions' entries; lower your own
  by hand.
- A session moved into a worktree with `EnterWorktree` has heredocs, compound commands, and
  `git -C` refused. Write a script to the scratchpad and run it by path, and `ExitWorktree`
  (keep) to merge in the main checkout.
- `main` moves every few minutes. A fast-forward of `main` to a branch lost the race twice;
  check `git merge-tree --write-tree main <branch>` and merge in the main checkout.
- `onto test` syncs the main checkout's working tree; `npm run test:fleet` tests a commit.
- core and labkit pin blits 0.10.0 as of `aa10e59f8`; a checkout that predates it needs
  `npm install`. "Play a voice once unless it is told to loop" is not in 0.10.0 but unreleased,
  and the codec is safe for it.

## Core split (package extraction), 2026-10-11 night

Done: the animator left core as `@weasel-js/animator` (`git log --grep animator-package`), which
retired the TODO entry. `@weasel-js/renderer`, `@weasel-js/parallax`, and `@weasel-js/minimap` went
before it. `.changeset/animator-package.md` says what moved and what core keeps.

`@weasel-js/animator` was seeded on npm at 1.9.4 on 2026-10-12, with its trusted publisher
registered; `npm run test:smoke:registry` installed all 36 packages clean afterward.

**Made on my own read, none ruled on:**

- The animator's names left core outright (`useAnimator`, `createTarget`, the timeline and rig
  math types, and the rest); core re-exports none of them. Parallax and minimap went the same way.
- `animator.stagger(items, delay).springPose(...)` is gone; `staggerSpringPose(animator, adapter,
  { items, delay, to })` in core replaces it.
- `Target` gained `committed()`, `commit(value)`, and `axes`, and the animator exports `axesOf`.
- ui, diagram, d3, minimap, and labkit take the animator as a peer, and labkit keeps it out of its
  bundle, because the animator's record of each target is module state.
- Two size allowlist entries went up one line each (`Specimen.tsx`, `createKeyframeLayer.tsx`).
- The earlier ones: core's `/renderer`, `/mesh`, and `/patterns-builtin` subpaths stay; the
  renderer's index exports `getProgramSource`, `strokeReachAt`, `boundsMissRect`, and the draw-kind
  registry; `stopsOf`, `fromStops`, `toSvg`, and `colorOf` sit on core's half of a paint kind.

**Traps:**

- A new package needs more than its directory: the `fixed` group in `.changeset/config.json`,
  `paths` and `include` in the root `tsconfig.json`, `build:leaves` or `build:downstream` in the
  root `package.json`, the dependents' manifests, the README table, and hand-written
  `package-lock.json` entries. `git show 01d6e4ec0 --stat` is the list. A checkout that predates
  the package also needs `node_modules/@weasel-js/<name>` linked to `../../packages/<name>`,
  which `npm ci` does.
- A test file that needs the scene stays in core even when what it tests moved; one that needs
  only the animator moved with it and runs under the `weasel-ui` project.
- `npm run test:fleet | tail` reports tail's exit code. Read the pass counts, or log to a file.
- The lazy mesh kind (`core/paint/meshKindLazy`) is rebuilt self-contained from the renderer's
  *dist*, so `REGISTRY_STATE` in `packages/core/vite.config.ts` allows only `dist/mesh.js` from
  it. A module shared between the renderer's index and its `mesh` entry becomes a shared chunk
  and fails core's build.
- `vi.mock` of a renderer or animator module from core has to name the package and spread
  `importOriginal`, since core imports everything through the package's index.

## Skinning and clips, 2026-10-11 late night

Both are on `main`. `docs/concepts.md` ("Clip", "Rig and skin") describes them, the
"Timelines and rigging" section of `docs/TODO.md` holds what they left open, and `.changeset/`
says what changed for a consumer. This is only what those do not say.

**Decided with Mike:** the blend runs on the CPU over a path's own points, not on the mesh or in
a shader; the bone and weight tools were in scope; a skeleton lives in a node's data, and joints
are not scene nodes. He then said to stop bringing him forks ("just pick one").

**Made on my own read after that, none ruled on:**

- Weights are one array per joint name, indexed by point, curve handles weighted like anchors.
- `autoSkin` gives a joint with no child no weight, so a limb needs an end joint.
- A bent path reaches the canvas as `PoseOverride.path`, with the override's pose set to the
  path's bounds. A hand-written `RigScene` now needs `update`.
- A live `SampledTrack` carries `targetName` and `interpolateName`, and a `TimelineEvent` a
  `name` and `data`; `toClip` throws on an `onTick`.
- `docs/superpowers/specs/2026-08-22-animation-timeline-rig-design.md` is deleted as fully built.
- Whether a node holding a skeleton should stop clipping its children by itself. Left alone: a
  rig node sets `clipFromPose: () => null`, as the rig tools demo does.

**Traps met here:**

- A site dev server started in a worktree under `.claude/worktrees/` did not see edits made
  there, by the Edit tool or by a script, and a `touch` did not wake it. Restart it before each
  browser check and confirm with `curl` that it serves the edit. Cause not found.
- A fleet run's last lines are not its result. Send the whole log to a file and grep it for
  `FAIL` and `onto: tests`; piping through `tail` lost the name of a failed file.
- Three of five fleet runs had failures: one unnamed file, then three browser-test timeouts,
  then a different three, none in files this work touched. The other two runs were clean, and
  the first set of three passed when run alone.


## The fourth TODO pass, 2026-10-12 evening

Twenty-one agents, each in a worktree of its own, took the unclaimed entries of `docs/TODO.md`
section by section; their branches met in one integration branch and reached `main` at `d91ce16b0`.
`git log 9b7c18251..d91ce16b0` and `.changeset/` are the record. The gate passed on that
commit. Two fleet runs of the branch before it: 4 failures (stale token counts in the theme
editor's tests, fixed), then 9, every one a timeout in a file that passes alone and passed in the
first run. What the log does not say:

- **Behavior and API changes made on an agent's judgment, none ruled on.** Each is one commit with
  a changeset that says so.
  - ui: buttons draw flat by default and `--wzl-gloss` turns the glass on (this one follows the
    2026-10-11 ruling); `--wzl-z-modal` is 1000; gradient handles are 10px; `Tree` lost
    `onExternalTarget`; `tone` and the plot, curve, and badge colors take a `ColorSource`; a rail
    page draws in schema order; a `Timeline` with no `transport` draws the readout and Graph
    switch only.
  - core: a `LayerGroup` with alpha fades as a group; mode eligibility needs every tag allowed; a
    `<select>` is not a text field; `/clone` exports types only; a removal deselects its nodes; a
    replayed op whose node is gone is skipped; an adapter whose layer list changes must implement
    `subscribeLayers`; the image cache has a 256MB budget; a full glyph atlas is emptied whole.
  - labkit: `isEntryShown` takes the resolved schema; `DragState` carries `from`; a remote mark
    write rebuilds the store. hud and forge take a `ColorSource` tone.
  - draw: Open replaces the document and Import appends; the grid is off by default.
  - New surface: `win9xTheme` and `platinumTheme`, `createScore` in audio, unit expressions and
    per-axis units, the `slots`, `pack`, `quadtree`, and `perContainer` layouts, range selection,
    a `hover` gesture, Trim and Merge, `rewind` on the pose animations, `fixedSeat` in gestures.
- **Not seen in a browser:** nearly all of it. Most at risk: flat buttons and both new themes, the
  site without its own palette, `Split`'s sidebar as a size container (popovers and drags inside
  it), draw's path-edit entry, toasts, and Import button, the glyph atlas reclaim, the new layouts
  under a drag, and the Trim and Merge icons.
- **Weak evidence:** the animator's frame-cost and churn numbers are single runs on a busy
  machine. `node tests/perf/target-reads/run.mjs` on a quiet one is the check.
- **Left for a ruling, each in its entry:** the new word for `features`, the second cue for
  disabled controls, `arrayAdapter` as the default adapter, playing an animation backward, holds
  as rows of a target table, whether text ingests by default, snapping the canvas's baselines, the
  Align bar under an omitted `direction`, and which look wins between labkit's menu and ui's.
- **Decided against, 2026-10-12:** changing the default theme's status, code, or secondary text
  colors for contrast. A fix was built and shown, and Mike had it reverted in both modes. Do not
  change a color, a token, or a gate for a contrast ratio unless he asks.
- **Not done:** the `SceneCanvasInner` and `scene.ts` splits were held back so they would not
  collide with the pass.

## The fifth TODO pass, 2026-10-13 overnight

Fourteen agents, each in a worktree of its own, took `docs/TODO.md` section by section; their
branches met in `todo-pass-5` and reached `main` in three fast-forwards, each to a commit whose
fleet run was green (`5e61f4904`, `b965c7c04`, `695abfcf9`). The TODO went from 22 P2 and 144 P3
to 17 and 128 while other sessions added entries. A second wave of five agents then took what the
first left because files were held (`aa9f779de`, `6f67d9956`, both green); its calls are the last
bullets of each list below. What the log
does not say:

- **A fleet run can test a tree that is not its commit.** `onto` keeps one tree per repository on
  a node and every weasel worktree syncs into it. `npm run test:fleet` now fails such a run
  (`scripts/fleet-tree.gate.ts`). A run counts only if its log has `fleet-tree: N changed path(s)
  match <sha>` and that gate test passed, not skipped. The cause and the fix belong to
  `~/src/onto` and are written up in the TODO ("`onto` can start a suite in a tree another session
  synced"); nothing was changed there.
- **`fseventsd` on orochi sat at 99% CPU all night and delivered no directory events** to
  processes started here (`fs.watch` on a directory: nothing in 12 s; on a single file: 1 ms). That
  is what made forge's dev server serve stale modules and its watcher tests fail locally. What
  feeds it is not known. forge now warns at startup when its watcher is silent, and
  `plugin.test.ts` polls.
- **A fleet node keeps vite's dep cache between runs**, so the first run to meet a dependency newly
  imported by browser-tested code fails a dozen suites. `optimizeDeps.force: true` is not the fix:
  with it the browser session never connected, twice. The `browser` project's
  `optimizeDeps.include` lists `zustand/react/shallow` by hand; the TODO has the entry.
- **Behavior and API changes made on an agent's judgment, none ruled on.** Each is one commit with
  a `patch` changeset that says so.
  - Rendering and text: an emoji paints as one glyph in its own colors, so text holding emoji
    measures and wraps differently; `GlyphTextureSink` gained required `uploadRGBA` and
    `subImageRGBA`; an image under a color matrix that only scales channels within 0 to 1 joins
    its batch as a vertex tint.
  - Canvas: `WeaselRenderer` no longer writes inline `width`/`height` (ruled 2026-10-11); a kit
    canvas now takes its size from a class in `@weasel-js/core/style.css`, and a page without that
    stylesheet shows it at buffer size. A pre-built `{ layer }` in `<SceneCanvas layers>` paints.
  - Tools and gestures: Shift snaps a rotate to 15 degrees by default; `multiTouch.rotation` is
    degrees since the gesture began; `ToolBounds` is gone from routing; `createDispatcher` is eight
    modules; a marquee or lasso wholly inside a stroke-only shape no longer selects it.
  - SVG and paths: under `openFill: 'none'` an open subpath is no longer closed by import, export,
    or the booleans; a path mixing closed and open subpaths exports as a `<g>` of two paths;
    `serializeSvg`'s `pretty` now indents; `splitByClosure` and `hasOpenSubpath` are new geom API.
  - Animation: a rig posed with `rig.pose` stays posed across a `useRigNode` rebind;
    `RigEditState` gained `painted()` and `paint(next)`; a spring or coast with no `onTick` is not
    ticked every frame; a paused looping timeline seeked to its `duration` stays at the end; a
    skinned path's weights are spliced through anchor edits, not weighed again with `autoSkin`
    (`EditAnchorsDep.applyEdit` takes `origins`); `DerivedDep.path` answers a pose override's
    path ahead of a derived one. Neither is seen in a browser.
  - ui and prefs: "None" is offered on every paint nested in an object leaf, and a record with no
    `paint` reads as None; a `ColorList` item may be a `ColorSource` (strings stay legal); a closed
    `PrefsStore` warns on its first write; a band's `aria-label` carries its range; the bevel
    themes reach checkbox, radio, switch, popover, tooltip, and `Dialog`; new exports to make
    types nameable (`CameraProps`, `CanvasViewState`, `CanvasLayers`, `SceneSlotLayers`,
    `OpsApplier`, `strokeRegion`, animator's `Naming`, gestures' `Point`, ui's `LiveControl`,
    `OnTokenChange`, `OptionKey`).
  - Audio: the platformer's bed is engine voices, and `voiceLimit` went from 24 to 48.
  - Build: seven stores notify through `createEmitter`; the root `tsconfig` `paths` block is
    generated (`npm run gen:tsconfig-paths`) and a test fails when it drifts;
    `preserve-manual-memoization` is on; each action's code has one directory.
  - Second wave: `TargetTransform` is `{ identity, toWorld, toLocal }` and `annulusSemiAxes`
    takes one, so chrome follows a pose's `transform`; `animateOnSetPose` and `animateLifecycle`
    take the adapter methods they use, with changed type parameters; a `modifierHeld` rule matches
    on a `<SceneCanvas>` and reads modifiers window-wide, a focused text field included;
    `overflow="menu"` on `Bar`; `QuantityText`; tabs, sliders, the segmented control, and toolbars
    read the bevel hooks; every store outside the five leaf packages notifies through
    `createEmitter`, and six packages gained a `@weasel-js/registry` dependency; core's `paths`
    are generated; `buildScene` is three modules; draw's `App.tsx` is split into `Editor`,
    `Workspace`, and hooks, and two of its dev pages were split with no entry asking for it.
- **Not seen in a browser:** the rotate ring and a live resize on a skewed node; the bar overflow
  menu and `QuantityText` as pixels; `AnimationDemo` on the kit's adapter; draw's two dev pages;
  the canvas size change in `apps/draw` and the site's demos; an emoji,
  by a person, at any size; "None" on a nested paint; the bevels under `win9xTheme` and
  `platinumTheme`; gradient handles on a skewed node; the split SVG export in a renderer; the rig
  tools demo's live weight stroke; the rotate snap; the `pretty` output in `SvgDemo`; a pre-built
  slot layer on a canvas.
- **Never run:** any package build since the wildcard `paths` keys went, `test:smoke:consumer`,
  `check:treeshake`, the API reference build after its fixes, and
  `tests/perf/image-quad.spec.ts` after its `unmerged` frame was edited.
- **Left for a ruling.** Each is in its TODO entry; these are the ones an agent stopped on.
  - Scene: which of geom's `Mat3` and `mat3` is renamed; what a partial duplicate does to a copied
    edge; whether pose overrides grow a `data` field; whether the `layouts` prop is retired; what
    composition does for a non-rect `TPose`; where a container's scroll offset is held; how
    per-subobject scale scopes resolve.
  - Panels: whether a slider dragged in a `SelectionPanel` is one undo step; whether a node with
    no `fill` record reads as "None"; whether a `ColorList` keeps accepting strings; what a write
    to a closed `PrefsStore` does; what two `usePrefsStore` callers with different schemas on one
    prefix get; whether the text tool's percent unit becomes data; whether `ToggleBar`'s `minimal`
    honors `size`; whether an empty or hidden tab group joins a tab run; whether a long bar
    overflows into a menu by default; borders inside the bevel themes.
  - Text and paint: an emoji under a gradient or pattern fill; a zero-advance combining mark and
    kerning; an atlas-less code point's advance under fallback `'none'`; whether `@weasel-js/text`
    may depend on `@weasel-js/stroke` for synthetic bold; where a group's label draws; markers on
    a split SVG path; whether an image color scale past 1 folds into the batch.
  - Tools: Shift-snaps-rotate by default or opt-in; whether a binding can say it yields when its
    action declines (draw's two route-conflict warnings).
  - Animation: `ClipKey` generic over its value; events on laps a frame skips; `Naming` as a
    public name.
  - Build: whether a kit canvas should need core's stylesheet or core should adopt the rule
    itself; labkit's bundled siblings as externals; fewer workers for the `browser` project on the
    fleet; a curated exports inventory for the Bundle Inspector.
  - Second wave: how a group resize writes a turned leaf's shear; which ops animate if
    `<SceneCanvas>` wraps its own adapter; what `selectTool.rotate === false` means once its three
    deciders are one; what the command palette's selection summary prints; who owns "a text edit
    is open" in draw; how a preview drag tells a fragment from its first row; `overflow="menu"` as
    a bar's default; `QuantityText` in the kit's own controls; the bevel assignments (two
    screenshots went to the wall); where a lab keeps another schema's values; a heading control
    as a pref leaf; a path-neutral section in a `PrefGroup` tree; the emitter for the five leaf
    packages.
  - By ear: the music bed's level, and whether each cue in the `score` demo reads as its name.

