# @weasel-js/animator

## 1.13.0-rc.0

### Patch Changes

- 38d5ad1: Depend on `@msb235/blits` 0.12.0, which has no breaking changes from 0.11.0. Its fixes make a single `fn` voice over many subjects, the shape weasel's animator uses, cheaper per frame.
- Updated dependencies [7e5f9e3]
- Updated dependencies [c7516cd]
- Updated dependencies [8c39126]
- Updated dependencies [769eef8]
- Updated dependencies [4c113da]
  - @weasel-js/geom@1.13.0-rc.0
  - @weasel-js/paint@1.13.0-rc.0
  - @weasel-js/react@1.13.0-rc.0
  - @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- Updated dependencies [dbd6711]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [400b393]
- Updated dependencies [40d87f7]
- Updated dependencies [78f29de]
- Updated dependencies [2c52cc5]
- Updated dependencies [94ebd35]
- Updated dependencies [3bf5edb]
- Updated dependencies [91a1d84]
  - @weasel-js/geom@1.12.0
  - @weasel-js/paint@1.12.0
  - @weasel-js/react@1.12.0
  - @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- 768be71: Depend on `@msb235/blits` 0.11.0, where stopping an animation no longer costs time in step with how many are running. blits' `loop` now defaults to one pass; no voice weasel cues depends on it, since each is either a motion (a tween or a spring) or a patch with no duration, and blits ignores `loop` for both.
- Updated dependencies [4d99526]
- Updated dependencies [e30f4df]
- Updated dependencies [13fc67f]
- Updated dependencies [50da815]
- Updated dependencies [0f455dc]
- Updated dependencies [15efc86]
- Updated dependencies [07b686c]
- Updated dependencies [041bc38]
- Updated dependencies [2b267d5]
- Updated dependencies [8f2c044]
- Updated dependencies [71d4416]
- Updated dependencies [cee04b9]
- Updated dependencies [e1eeb08]
  - @weasel-js/geom@1.11.1
  - @weasel-js/react@1.11.1
  - @weasel-js/paint@1.11.1
  - @weasel-js/registry@1.11.1

## 1.11.0

### Patch Changes

- 6a53aaa: Holds cost a frame much less. A hold on a target table's row keeps its value and weight in the table's own arrays, and the table shows its held rows in the same pass that shows its moving ones: at 10,000 rows, a hold whose value is a function went from about 730 to 100 ns a row a frame, and one of plain values from 12 to 4. A timeline track or rig clip with a constant weight is read only when the playhead moves it.
  
  `animator.holdRows({ table, rows?, weight?, axes? })` holds many rows of a table at once. Its handle's `values` (laid out as `table.committed`) and `weights` (one a row) are written in place, then shown with `touch()`; each row is a hold like any other, mixed with the row's other holds, covering the moves behind it, and committing what it showed when released or canceled. A row stopped through its target, or removed from the table, is let go of.
- 193ba96: A loop played backward now runs back through every pass before the one in flight, not just that one. Once the pass in flight is back at its start, the loop starts the pass before it at its end and plays it back, down to the start of pass 0, where it ends and `onDone` runs. The factory is handed each earlier pass's own index, and turning the loop forward again partway carries on from there. A tween, with `onTick` or on a target, starts at its end when a loop playing backward starts it, and a loop with a `count` started that way starts its last pass at that pass's end. A spring, a decay, a timeline, or a stagger started by such a pass starts at its start as before.
- 09c3e5f: A time scale below 0 plays an animation backward. `setTimeScale(-1)` on a handle, by key with `setTimeScaleByKey`, or on the animator runs each animation's clock back toward its start, while the animator's own clock goes on forward. Run back to its start, an animation ends there as it ends at its end going forward: a tween or spring on a target commits its start value, one with `onTick` is handed its `from` last, and `onDone` runs. A timeline's playhead runs back through the laps it has looped and ends at 0, firing no events on the way; a stagger ends once what it has in flight is back at its start. An animation started while the animator plays backward is at its start already, and ends at once. A time scale that is not a finite number is still refused.
- 535aaaa: A target table row with a tween or spring behind a hold is shown by the table's own pass. Such a row was read by itself every frame, at a single target's cost, and so was one where a hold had been released over a move or a stopped animation had left something beside a hold; at 10,000 rows a tween under a hold went from about 5.6 µs a row a frame to 0.04.
- 63b310c: Icons are named, not drawn, by the code that uses them. This is breaking.
  
  `@weasel-js/icons` is new. An icon is a qualified name, `namespace:name` (`core:undo`, `ui:close`, `path-tools:reversePath`), held as an `IconRef`. Each package's `icon()` makes one and qualifies its own bare names: in core, `icon('undo')` is `core:undo`. A registry supplies the glyphs: mount `<IconRegistryProvider icons variants>` from `@weasel-js/core` at the app root, or give `<WeaselProvider>` its new `icons` and `iconVariants` props. Core, ui and path-tools each publish their table at `./icons` (`import { icons } from '@weasel-js/ui/icons'`). A name no registered table holds draws a placeholder and warns in development, and draws nothing in production.
  
  `@weasel-js/icons-plugin` is new too. Its build plugin, `weaselIcons`, ships only the glyphs a build names. In an app's vite, rollup or rolldown build, `weaselIcons.vite({ mode: 'app' })` serves `virtual:weasel-icons`, holding the glyphs named by the app and by the weasel packages it imports, and fails the build on a name no table holds. `virtual:weasel-icons/all`, `/<namespace>` and custom variants each load as their own chunk, asked for with `useIconVariant(name)`. Types for the virtual modules are at `@weasel-js/icons-plugin/virtual`. The plugin is its own package so that installing `@weasel-js/icons` does not install a native parser. Core's and ui's `dist` is no longer minified, so the `@icon` annotations the plugin reads survive; a consumer's bundler minifies.
  
  What breaks:
  
  - routing: `Action.icon`, `ActionVariant.icon`, `ActionItem.icon` and `ToolPresentation.icon` take an `IconRef` from `icon()`, not a React node. So does `useCommand`'s `icon` option, which no longer takes a function read each time the command shows.
  - prefs: `PrefBase.icon` and an enum option's `icon` take an `IconRef`, not a free string. A schema saved with bare names, such as `"icon": "close"`, now draws nothing for them and warns in development; write `"ui:close"`.
  - core, ui and path-tools: the `…Icon` components are removed; draw `<Icon name={icon('core:rect')} />` instead. `NudgeAnchorsIcon` and its `dir` prop become four glyphs, `core:nudgeAnchors` (pointing right), `core:nudgeAnchorsUp`, `core:nudgeAnchorsDown` and `core:nudgeAnchorsLeft`. Core's `PaintKindEntry.icon` and `PaintKindFamily.icon` take an `IconRef`. Core's `ACTION_GLYPHS`, `IconProps` and `ActionGlyphProps` are gone, and so are ui's `ICON_PATHS`, `ICON_FILLS`, `ICON_GROUPS`, `MARK_ICONS`, `IconName`, `MarkIconName`, `FillableIconName` and `ActionIconSource`.
  - ui: `<Icon name>` and `mark`, `actionIcon` and `ActionBar`'s `icons` take `IconRef`s, and `isFillable` takes a glyph. `resolveIcon` draws a ref, or a qualified string read from data. `iconFromData(value)` reads a name from data as a ref, warning once in development about a bare one.
  - labkit: `CommandItem`, `ToolItem`, `ViewportControl` and `TrialTool` take an `IconRef` as `icon`, and so does `ConfigOption.icon`. `IconComponent`, the nine ui icon components labkit re-exported, and its `ICON_PATHS` and `IconName` are gone.
  - forge: `GlobalDeclaration.icon` takes an `IconRef`. `FrameSetup.icons` registers an app's own tables in every frame. A story's `control.icons` argTypes option takes qualified names (`'ui:statusSuccess'`); a bare `'statusSuccess'` now draws nothing.
  
  `@weasel-js/registry` exports `isDev()`, which `@weasel-js/react` re-exports. It reads `process.env.NODE_ENV`, which a production bundle folds to `false`, and the development diagnostics in core, routing, ui, labkit, renderer and animator all read it.
- 36eca7a: Breaking: `useAnimator` moved to `@weasel-js/animator/react`; the root entry has no React. `@weasel-js/core/math` no longer reaches routing or animator in its types. geom exports `FramedBox`. New `@weasel-js/font/metrics` entry carries `parseBmFont`, the face-metric readers and `cssFamilyName` with no DOM in its types, and `@weasel-js/diagram/layout` measures through it, so neither it nor `@weasel-js/diagram-elk` needs a browser. `faceMetricsOf` takes any value with `entry` and `outlineFace`, a `ResolveResult` included.
- Updated dependencies [304f53a]
- Updated dependencies [60d8e39]
- Updated dependencies [ed0e096]
- Updated dependencies [5338358]
- Updated dependencies [6072e93]
- Updated dependencies [53ba41a]
- Updated dependencies [7162a7a]
- Updated dependencies [765cd31]
- Updated dependencies [8374354]
- Updated dependencies [5adbb76]
- Updated dependencies [63b310c]
- Updated dependencies [ebb8804]
- Updated dependencies [c6a0a52]
- Updated dependencies [ad0b069]
- Updated dependencies [d32cb70]
- Updated dependencies [fb75358]
- Updated dependencies [7cbedd8]
- Updated dependencies [c17c978]
- Updated dependencies [a4c99c1]
- Updated dependencies [c53b0ae]
- Updated dependencies [c4840ed]
- Updated dependencies [616a4b2]
- Updated dependencies [0677769]
- Updated dependencies [974682d]
- Updated dependencies [7afe8cd]
- Updated dependencies [71c079d]
- Updated dependencies [dcca70c]
- Updated dependencies [5f12888]
- Updated dependencies [d18df3e]
- Updated dependencies [46c731d]
- Updated dependencies [36eca7a]
- Updated dependencies [c1680fd]
- Updated dependencies [0430dcc]
- Updated dependencies [1be2ea9]
- Updated dependencies [c2048de]
- Updated dependencies [9073669]
- Updated dependencies [f082c83]
- Updated dependencies [db8c16e]
- Updated dependencies [4df0749]
- Updated dependencies
- Updated dependencies [365ab72]
- Updated dependencies [7a31f9d]
- Updated dependencies [4cec295]
- Updated dependencies [1faab2d]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
- Updated dependencies [329aa39]
  - @weasel-js/registry@1.11.0
  - @weasel-js/geom@1.11.0
  - @weasel-js/react@1.11.0
  - @weasel-js/paint@1.11.0

## 1.10.1

### Patch Changes

- 3fda6e6: `ClipValue`'s object arm is `object`, so a pose typed by an interface (`RectPose`, a `TaggedTypedArray`) is a clip key's `value` without a cast. It was an index signature, which no interface satisfies. Breaking for code that read a member straight off a `ClipValue`: narrow it to its own type first. `toClip` still refuses a value JSON cannot round-trip.
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- bd6c203: A timeline frame that skips whole laps fires the same events under `loop: n` as under `loop: true`: the tail of the lap it left, then the lap it lands in, and nothing of the laps in between. Under a lap count it used to fire every skipped lap's events in full, and to report one `lap` to `animator.watch` per lap skipped; it now reports one, carrying the lap reached. Breaking for a handler that counted on a late frame replaying each lap.
- Updated dependencies [cbd5b4d]
- Updated dependencies [aaa2b4f]
- Updated dependencies [c7b7ed5]
- Updated dependencies [ee59ccd]
- Updated dependencies [b8bfb2d]
- Updated dependencies [35c4879]
- Updated dependencies [9eefcc7]
- Updated dependencies [886380f]
- Updated dependencies [d8b51a4]
- Updated dependencies [62e766c]
- Updated dependencies [ab9ea7a]
- Updated dependencies [e962494]
- Updated dependencies [10c5d41]
  - @weasel-js/geom@1.10.1
  - @weasel-js/react@1.10.1
  - @weasel-js/paint@1.10.1
  - @weasel-js/registry@1.10.1

## 1.10.0

### Patch Changes

- 96a63de: add `@weasel-js/animator`: the animator moved out of core. `useAnimator`, `createTarget`, `createTargetTable`, the timeline tracks and `sampleTrack`, the skeleton math (`resolveSkeleton`, `skeletonAxes`, `jointAxes`, `solveIk`, `mirrorPose`, `IDENTITY_JOINT`), the vertex-color helpers and `ColorOverrideRegistry`, `createSlew`, and every animator type (`Animator`, `AnimationHandle`, `TimelineHandle`, `Target`, and the rest) are exported from it and no longer from `@weasel-js/core`. Breaking: import those names from `@weasel-js/animator`. It needs geom, paint, react, and registry, and nothing of the scene.
  
  core keeps what moves a scene with it: `tweenPose`, `springPose`, `staggerSpringPose`, `createPoseTarget`, `momentum`, the `animate*` adapter wrappers, `useAnimatedReflow`, `bindRig`, and `useRig`, and still exports the easings from geom. The animator also exports `axesOf`, which gives the axes of a number, an array of numbers, or an object of numeric fields.
  
  `@weasel-js/ui`, `@weasel-js/diagram`, `@weasel-js/d3`, `@weasel-js/minimap`, and `@weasel-js/labkit` take the animator as a peer beside core. labkit leaves it out of its bundle, as it does core: the animator keeps its record of each target in module scope, so an app has to hold one copy.
- 7140b5a: Adds API: a hold or a timeline track names the axes it holds. `HoldOptions.axes` and `SampledTrack.axes` take a name wherever they took an index: a plain object's field, `animator.hold({ target, value, axes: ['y'] })`, a rig's joint, `axes: ['armL']`, or one axis of a joint, `axes: ['armL.rotation']`. Names are typed against the target's value where it has fixed fields, and one the target has no axis for throws as the hold starts.
  
  A target's axes carry the names: `TargetAxes.names` is one name per axis, where a dot makes a path that a shorter name reaches as a whole. `axesOf` names a plain object's axes by its fields and `skeletonAxes` names a pose's `<joint>.<field>`; axes written by hand name theirs by setting `names`. `target.axisIndexes(['y'])` answers the indexes for a caller that wants the numbers, and `jointAxes` goes through the same lookup. `AxisName` and `AxisRef` are the types.
  
  Adds API: the stagger builder moves targets. `.tween` and a new `.spring` move each item where the items are targets, `animator.stagger(targets, 80).spring({ to: (target) => ..., preset: 'wobbly' })`, or the target a `target` option names for the item, one for them all or a function of the item. Both keep the form that hands values to `onTick`, and `.tween` there takes an `interpolator`. The option types are `StaggerTargetTweenOptions`, `StaggerTargetSpringOptions`, and `StaggerSpringOptions`.
  
  Breaking, within this unreleased surface: a clip's axis names no longer go through the binder. `ClipBinder.axes`, `SampledTrack.axisNames`, and `sceneClipAxes` in `@weasel-js/core` are gone, since a rig's target answers its own joint names; drop `axes` from a binder and a clip naming joints plays as before. `bindClip` now also throws on a numeric axis out of the target's range, where that used to wait for the playhead to reach the track.
- 126116b: A clip can hold a path. `toClip` used to throw on a key whose value has a typed array in it, which is every `Path`. It now writes each one as its type's tag and its numbers, `{ __ta: 'f32', data: [...] }`, at any depth of the value, and `bindClip` makes it the typed array again, so a track tweening a path-shaped pose goes through `JSON.stringify` and `JSON.parse` and back. An event's `data` is passed as written, as before.
  
  Changed behavior: `bindClip` now copies each key's value where it used to share it with the clip, so a plain object in a key's value that has `__ta` and `data` members of that shape is read as a typed array.
  
  Adds API in `@weasel-js/geom`, where the encoding lives: `tagTypedArrays(value)` and `reviveTypedArrays(value)` copy a value with its typed arrays tagged or made again, `typedArrayReplacer` is the first as a `JSON.stringify` replacer, and `tagTypedArray` and `untagTypedArray` do one array. Every number array type is covered: `Int8Array` through `Float64Array`, `Uint8ClampedArray` included. The types are `TaggedTypedArray`, `TypedArrayTag`, and `NumberTypedArray`.
- 9296fb4: Adds API: a clip can name the part of a target a track holds. `ClipSampledTrack.axes` takes names as well as numbers, `axes: ['armL', 'foreL']`, which the track's target resolves against its own axes, so a track over some of a rig's joints holds the same joints after the skeleton's joint order changes. The live track carries the names as its `axes`, and `toClip` writes them back. `bindClip` throws when a track names axes and has no target, or names one its target does not have.
  
  Numbers go on working as positions in the target's axes, for a target that has no names, and a clip written with them binds as before.
- 6ba0496: Adds API: a clip can name a track's weight. `ClipSampledTrack.weight` takes a name as well as a number, `weight: 'fade'`, and `bindClip` asks the new `ClipBinder.weight(name)` for the function it stands for, read each frame as a function `weight` on a live track is. That is what a crossfade between clips needs: the clips stay data and the fade is the binder's. The live track keeps the name in the new `SampledTrack.weightName`, and `toClip` writes it back; a function weight with no `weightName` still throws. `bindClip` throws on a name the binder does not resolve.
- 7bac60f: A timeline's `subscribe` and `subscribePlayback`, and `animator.watch`, now notify through `createEmitter`. Each already kept going past a listener that throws; the logged message changes to `weasel: a subscriber threw`. A listener added during a notify now waits for the next one, where it used to be called in the same pass.
- fb715f4: A listener that throws no longer stops the listeners after it, or throws into whatever caused the notify, in these stores: `createRigEditState`, the bone, weight, and slice tools' overlays, the view registry, a canvas renderer lease's `subscribeRestored`, and the animator's `onTick`. Each now notifies through `createEmitter`, so the error goes to `console.error` as `weasel: a subscriber threw`; `onTick` already kept going, and its message changes to that one. A listener added during a notify now waits for the next one.
- 1bd7fdc: Starting an animation under a `cancelKey`, and stopping a target, no longer cost more the more animations are running. Each searched the animator's whole table: a start for whoever held its key, `target.stop()` and a table's `remove(row)` for the animations on the target, and `cancelKey`, `isActive(key)`, `pauseKey`, `resumeKey`, and `setTimeScaleByKey` likewise. The animator now keeps its animations by key and by target. With 10,000 tweens running and 100 restarted a frame, a keyed start took 434 µs and takes 12, a cancel by key 325 µs and now 83, and a `target.stop()` 381 µs and now 69 (`node tests/perf/target-reads/run.mjs churn 10000 keyed` and `... churn 10000 stop`, one run each before and after on a machine busy with other work). What a cancel still costs is blits forgetting the voice. Nothing a caller sees changes.
- d58d2e8: animator: a hold covers the move an animation's destination makes in the committed value. `tween({ target, to })` or `spring({ target, to })` started under a hold used to jump the value on screen by the hold's weight times the travel and settle back; now a full hold shows none of it and a hold at 0.5 shows half, with no jump. A coast, a spring pushed where it stands, and a `from` away from the committed value still add on top of the hold. This changes what shows: a tween with no `from` no longer plays over a full hold, a tween or spring canceled under a hold commits its remaining move at once where it used to wait beside the hold, a hold released with a commit takes the share it covered of each move with it, and a spring's `setTarget(null)` commits where the spring had brought the value before it coasts.
- 3adb0d9: A hold costs about a third less each frame. Reading a target's holds built some eight small arrays and objects per target per frame: two copies of the committed value, a copy of each hold's value, and the fold's own working arrays. It now builds one. With 10,000 target table rows each under one hold, a frame took 10.3 to 10.7 ms and takes 6.8 to 7.4; with 1,000, 0.54 to 0.61 ms and now 0.29 to 0.30 (`node tests/perf/target-reads/run.mjs table 10000 held`, plain Node on one machine). What a held target shows is unchanged.
- d02d059: animator: a time scale below 0, or `NaN`, is refused where it is set, on `setTimeScale`, a handle's `setTimeScale`, and `setTimeScaleByKey`. It used to be accepted and then throw from the next frame (`RangeError: blits: sync went back`).
- 3558fbb: Adds API: a timeline can be saved and loaded. A `Clip` is a timeline as data: `{ version: 1, tracks, duration? }` with keys, easings by built-in name or bezier points, and names wherever a live timeline holds a function or a target. `bindClip(clip, binder)` answers the `{ tracks, duration }` `animator.timeline` takes, resolving each sampled track's `target` and `interpolate` and each event's `name` through the binder, and throws on a name the binder does not know. `toClip({ tracks, duration })` reads a live timeline back into a clip, `handle.tracks()` included, so an animation changed in `<AnimatedTimeline>` can be saved.
  
  A live track now says what it is as well as what it does: `SampledTrack` has `targetName` and `interpolateName`, and `TimelineEvent` has `name` and `data`. `bindClip` sets them and a track written by hand can set them too. `toClip` throws, naming the track, on what a clip cannot hold: a target or `interpolate` with no name, an `onTick`, an `interpolator`, a function for `weight`, a function easing that is not a built-in, or a value JSON would not read back, such as a typed array.
  
  In `@weasel-js/core`, `sceneClipTargets(scene, { rigs })` is a binder's `target` for a scene: `pose:<node id>` is that node's pose target and `rig:<name>` the target of the rig given under that name.
- fa0ecbe: A frame of the animator no longer walks every moving target to clear what its animations started, stopped, or redirected since the last frame: it clears the targets that changed. With 10,000 tweens running and nothing restarted, five runs of a frame read 0.73 to 0.93 ms where they read 0.99 to 1.38 (`node tests/perf/target-reads/run.mjs table 10000 idle`, plain Node on one machine). Nothing about what a target shows changes.
- 32e243f: Adds API, in `@weasel-js/animator`: pure edits to a `Skeleton`, each answering a new one. `moveJoint(skeleton, name, x, y)` rests a joint at a point, worked back through its parent's frame, and the joints under it move along. `addJoint(skeleton, parent, x, y, name?)` adds a joint at a point under a parent or as a root. `removeJoint(skeleton, name)` removes a joint and everything under it and says which names went, and `dropSkinJoints(skin, names)` takes those joints' weights out of a skin. `jointPositions(skeleton)` answers where each joint rests and `jointAt(skeleton, x, y, reach)` the joint nearest a point.
- 233f856: Adds API, in `@weasel-js/animator`: the first piece of skinning, where one path bends with a skeleton. `skinPath(path, skin, motions)` moves each point of a path to where its joints' motions since the bind pose would carry it, averaged by weight, and answers a new path. A `Skin` is one weight array per joint name, indexed by point: every coordinate pair of a polygon path's `coords`, curve handles included, or a rect's four corners. `motionsFromRest(skeleton, world)` turns the joint world transforms `resolveSkeleton` or `Rig.world()` answers into those motions. `autoSkin(path, skeleton, { power, max })` makes a skin from each point's distance to the bones at the bind pose; a joint with no child gets no weight, so a limb needs an end joint.
  
  Nothing draws a skinned path yet: these are the pure functions the rig will call.
- 4b0a7d7: A spring or a coast on a target, given no `onTick`, is no longer ticked every frame to ask whether it has come to rest. It is ticked when it first could be at rest, worked out from how fast its damping can take its energy away, and again each time that turns out to be too soon: a handful of ticks over its life, where there was one a frame. Retargeting or pushing it works the time out again. Nothing a caller sees changes: it shows the same values and ends on the same frame. One with an `onTick` is ticked every frame as before.
- 5c9d69f: A hold of plain values costs a frame about what a finished tween does. `animator.hold({ target, value, weight })` with neither given as a function used to be read every frame like any other hold; its target is now read again only when the hold is touched, when another hold joins or leaves the target, or when the committed value under it moves. With 10,000 target table rows each under one such hold, a frame took 22.0 ms and takes 0.6 to 3.5; with 1,000, 0.52 ms and now 0.05 to 0.07 (`node tests/perf/target-reads/run.mjs table 10000 held`, plain Node, one run before and three after on a machine busy with other work, which is why the range is wide). A hold whose `value` or `weight` is a function is read every frame as before (`... table 10000 heldfn`), and so is a plain one while it shares its target with one.
  
  One thing changes for a caller: a `value` passed as an array or object and then written in place used to show at the next frame the animator ran. It now shows when `handle.touch()` is called.
- b8eba2f: A target table can keep `shown` as a `Float32Array`. `createTargetTable({ axes, shown: Float32Array })` has the animator's pass fill 32-bit floats, so a painter uploads `table.shown` as it stands and makes no copy a frame; `table.committed` stays a `Float64Array`, and the default for `shown` is unchanged. This adds API: the `shown` option, a type parameter on `TargetTable` and `TargetTableOptions` naming the array (default `Float64Array`, so existing uses read as before), and the exported `ShownArray` type. The option's name and shape were chosen on an agent's judgment.
- 222fd80: A frame no longer calls every animation. A tween on a target with no `onTick` has nothing to do until it ends, and a hold has nothing to do at all, so neither is ticked on a frame: the first is woken when its own clock reaches its duration, pauses and time scales counted. A frame also calls only the moving targets that have a `show`. With 10,000 tweens running on targets nothing reads, a frame took 1.25 ms and takes 0.28; with 10,000 target table rows each under a hold of plain values, 0.85 ms and now 0.30 (both trees' animators run in one process in alternating blocks of frames, fastest block of each, on a machine busy with other work; `node tests/perf/target-reads/run.mjs table 10000 idle` and `... held` time the same frames alone).
  
  Each animation's clock is now read off the animator's own, not summed frame by frame, which changes one thing a caller can see. Animations started while the animator is idle used to be charged the wait for the first frame each from its own start; they are now all charged from the first one's start, as their values already were. Two tweens of one duration started a few milliseconds apart before any frame therefore end on the same frame.
- 70cf20d: A paused looping timeline seeked to its `duration` stays there. It used to wrap to 0 and count a lap on the next frame, so a scrubber dragged to its right end showed the start. The lap is counted, and the events at the end fire, once the timeline plays again. A paused seek past `duration` still wraps.
- 90f8ec4: Adds API: types that documented exports already named, and that a consumer could not import, are now exported. `@weasel-js/core`: `CameraProps`, `CanvasViewState`, `CanvasLayers`, `SceneSlotLayers`, and `OpsApplier`. `@weasel-js/animator`: `Naming`. `@weasel-js/gestures`: `Point`. `@weasel-js/ui`: `LiveControl`, `OnTokenChange`, and `OptionKey`, the `string | number` a `Select`, a `ComboBox`, and `useAsyncOptions` each declared privately as `Key`.
  
  Adds API: `strokeRegion` in `@weasel-js/core`, the region a stroke covers along a path, which `applyOutlineStroke`'s documentation pointed at and `StrokeRegionOptions` already described.
- 0cef6a3: Animated vertex colors are rows of a target table. `animator.colorOverrides` keeps every node's colors of one length in one `createTargetTable`, so a frame of many nodes changing color fills them in one pass, and a painter's `resolve` copies a row where it read a target. With 10,000 nodes of four anchors tweening, a frame and its resolves took 825 ns a node and takes 374 (`node tests/perf/target-reads/run.mjs colors 10000`, plain Node on one machine).
  
  `createTargetTable` takes two callbacks: `set(row)`, called after a row is committed, and `show()`, called once a frame after the animator fills `shown`.
  
  Two things behave differently. A target from `colorOverrides.target` that was released or cleared while resting now throws when it is read or committed, where it used to come back into the registry; ask the registry again, as its docs already said to. The same holds for `table.target(row)` after `table.remove(row)`, which used to write into whichever row took the index next.
- 98ec291: Adds API: `useWeightTool({ scene, rig })`, a tool that paints bone weights on the canvas. It works on every path under the rig node and writes each one's `data.skin`. A click on a joint makes it the active one. A drag is a round brush: points under it follow the active joint more, the nearer the brush's center, and their other joints give way so each point still sums to 1. With Alt held they follow it less. A click away from any joint is one dab. Every point, curve handles included, shows as a dot colored by the active joint's share of it, with the skeleton drawn over them. A stroke is one undo entry. Its key is W; mount it with `tools={{ weight }}`, and hand it the same `createRigEditState()` as the bone tool so both act on one joint.
  
  `setWeights(skin, count, joint, weights)` and `brushWeights(coords, x, y, radius, current, mode)` are the pure edits behind it, in `@weasel-js/animator`.
  
  The rig in view is bound from the document, so a stroke bends the path when it ends, not while it is painted.
- Updated dependencies [a86d79f]
- Updated dependencies [1837952]
- Updated dependencies [126116b]
- Updated dependencies [b1f7521]
- Updated dependencies [18547a3]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [3bacb3e]
- Updated dependencies [b260415]
- Updated dependencies [54174b6]
- Updated dependencies [4edad85]
- Updated dependencies [335f192]
- Updated dependencies [7b9de2d]
- Updated dependencies [ea54a64]
- Updated dependencies [955defa]
- Updated dependencies [27b827e]
- Updated dependencies [ee08fa5]
- Updated dependencies [54242f0]
- Updated dependencies [46fcc7e]
- Updated dependencies [a297730]
- Updated dependencies [1d34f51]
- Updated dependencies [80b29f6]
  - @weasel-js/geom@1.10.0
  - @weasel-js/paint@1.10.0
  - @weasel-js/react@1.10.0
  - @weasel-js/registry@1.10.0
