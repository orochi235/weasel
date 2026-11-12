# @weasel-js/animator

## 1.19.1

### Patch Changes

- e17dbd6: An animation is painted the frame the animator advances it, not the frame after.
  
  <!-- entry: fix -->
- Updated dependencies [71c3f85]
- Updated dependencies [1691dec]
- Updated dependencies [b62d643]
- Updated dependencies [87bf0a8]
- Updated dependencies [8725f6c]
- Updated dependencies [d5593b2]
- Updated dependencies [1da0762]
- Updated dependencies [9f44d6d]
- Updated dependencies [d11f1df]
- Updated dependencies [8562ebe]
- Updated dependencies [2c3416d]
  - @weasel-js/geom@1.19.1
  - @weasel-js/paint@1.19.1
  - @weasel-js/react@1.19.1
  - @weasel-js/registry@1.19.1
  - @weasel-js/clock@1.19.1

## 1.19.0

### Patch Changes

- 8d3f30f: `axesOf` keeps a plain object's own `__proto__` field, as `JSON.parse` makes one, when it builds a value back from its axes.
  
  <!-- entry: rank=-5 fix -->
- 24fe08a: Frames far apart on the clock no longer throw: the animator's clock stops at `Number.MAX_VALUE`, as an endless clock does. A frame gap past the double range counts as the largest double.
  
  <!-- entry: fix -->
- ebc9f52: A tween shorter than 1 ms, on its own or on a target, moves at its own length rather than as a 1 ms tween.
  
  <!-- entry: fix -->
- 63ce1c6: A timeline frame played backward fires no events, including one at the time a seek landed on.
  
  <!-- entry: fix -->
- ec703b3: A timeline canceled by one of its own event handlers fires no more events, in that frame or after.
  
  <!-- entry: fix -->
- eb8743c: A seek on a timeline with an infinite `duration` lands at the time asked.
  
  <!-- entry: fix -->
- 871e410: An endless timeline on a clock near `Number.MAX_VALUE` keeps its playhead inside its lap, and a seek to `Number.MAX_VALUE` lands there too.
  
  <!-- entry: fix -->
- 5be32af: A timeline, root or nested, throws a `RangeError` on a `NaN` `duration`, as a tween does on a `NaN` `ms`.
  
  <!-- entry: fix -->
- 857c097: A timeline with a negative `duration` plays as one of no length, its playhead at 0.
  
  <!-- entry: fix -->
- b1309b2: An animator tween with its own `interpolate` or `interpolator` ends exactly at `to`. It is handed exactly 1 on its last frame, whatever its easing answers there.
  
  <!-- entry: fix -->
- ee0609a: Releasing a weight-0 hold with a commit, under holds that cover the target outright, leaves the committed value where it was.
  
  <!-- entry: rank=-5 fix -->
- cd31516: A d3 transition ends every node exactly at its target pose, and a numeric `tween` exactly at its `to`.
  
  <!-- entry: fix -->
- b1309b2: A typed array's `NaN`, `Infinity`, `-Infinity` and `-0` survive a JSON round trip through `tagTypedArrays`, which writes them by name. Files saved before still read as they did. An animation clip still refuses a typed array holding a non-finite number.
  
  <!-- entry: fix data -->
- 352b221: The weight brush paints each point's share of the active joint, so painting a joint raises it even on a skin whose weights do not sum to 1.
  
  `jointShares(skin, joint, count)` is the share the brush and the weight overlay both read.
  
  <!-- entry: fix api -->
- Updated dependencies [aaeec8d]
- Updated dependencies [65ee9a0]
- Updated dependencies [8c4c266]
- Updated dependencies [6ae419d]
- Updated dependencies [b1309b2]
- Updated dependencies [153719c]
- Updated dependencies [bce00fd]
- Updated dependencies [98a8020]
- Updated dependencies [6d7aae1]
- Updated dependencies [326d7be]
- Updated dependencies [2740ed4]
- Updated dependencies [f8a6830]
- Updated dependencies [9ec70fe]
- Updated dependencies [d09a6c1]
- Updated dependencies [42e088a]
- Updated dependencies [214a57e]
- Updated dependencies [8a41dc2]
- Updated dependencies [433a5ad]
- Updated dependencies [b1309b2]
- Updated dependencies [01e5634]
- Updated dependencies [4ecaf12]
- Updated dependencies [3ed07dc]
- Updated dependencies [25b09cf]
- Updated dependencies [867f10c]
- Updated dependencies [d5a83f9]
- Updated dependencies [799636f]
- Updated dependencies [c09afdf]
- Updated dependencies [e36ca03]
- Updated dependencies [d83feb6]
- Updated dependencies [337b676]
- Updated dependencies [c2465cd]
- Updated dependencies [458e1c2]
- Updated dependencies [dd13518]
- Updated dependencies [b62813d]
- Updated dependencies [f68d93b]
- Updated dependencies [6321d2a]
- Updated dependencies [b1309b2]
- Updated dependencies [7a7c2ef]
- Updated dependencies [f718790]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [2bf3397]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [f0c159d]
- Updated dependencies [886642a]
- Updated dependencies [b1309b2]
- Updated dependencies [2f5f287]
- Updated dependencies [eaff448]
- Updated dependencies [b1309b2]
  - @weasel-js/geom@1.19.0
  - @weasel-js/clock@1.19.0
  - @weasel-js/paint@1.19.0
  - @weasel-js/registry@1.19.0
  - @weasel-js/react@1.19.0

## 1.18.2

### Patch Changes

- 99b8ada: Fixes to slews, color cycles, bus gains and the node raster host found by an audit of the motion and media packages.
  
  - `slewToward` and `createSlew` stay finite over a step of zero time. A direction with no rate jumps to the target whatever the step, and a limited one holds over a zero, negative or NaN step. Before, an unlimited direction over `dt` 0 answered NaN, and a slew kept that NaN from then on.
  - `cycleVertexColors` throws a `RangeError` for a `msPerCycle` that is not positive, before it installs anything. Before, 0 or NaN painted NaN colors, and a negative time turned the colors backward, which `direction: -1` does.
  - A bus's `setGain` throws a `RangeError` for a value or ramp that is not finite, and keeps the gain it had. Before, it kept a NaN gain, and every later mute or solo on any bus rewrote it and threw from a real `AudioParam`.
  - A voice's `setGain` refuses the same, by the same check, and keeps the level it had. Before, a NaN gain made every later `setPosition` on the voice throw.
  - A node raster host's `render` returns pixels whose `data.buffer` holds only them. Before, a small image was a view into Node's shared `Buffer` pool.
  - A node raster host disposed while its page is still opening rejects the render in flight as on a disposed host, rather than with the closed page's error.
- db5276d: Fixes to audio voices and patterns, clock syncing, timeline seeks, tween durations and the node raster host.
  
  - A voice's `gain`, `rate`, `detune`, `pan` and `position`, given to `play`, `playNote`, `playNoise` or `stream` or set on its handle, and the position `setListener` takes, throw a `RangeError` when not finite. Before, a real AudioParam threw after the voice had kept the value, and a worklet voice mixed NaN into its whole bus. This newly throws where a non-finite value used to be accepted.
  - `setListener` throws a `RangeError` on an option that is not finite (`refDistance`, `maxDistance`, `rolloffFactor`, `panWidth`, `right`). Before, it gave every positioned voice a NaN gain or pan.
  - A pattern player's `start` throws on a time that is not finite before it counts itself playing. Before, it threw from the booking and was left reporting `playing()` true with nothing booked, so a later `start` did nothing.
  - A full voice pool whose every voice scores NaN steals one, where it found no victim and threw.
  - A clock's `sync` throws a `RangeError` on a time that is not finite. Before, one such sync left `elapsed` NaN for good.
  - A timeline `seek` before 0 lands on 0, and one past `duration` with no laps left lands on `duration`. Before, `seek(-20)` reported `time()` as -20 and held the playhead at 0 for 20 ms before playing.
  - `animator.tween` throws a `RangeError` on an `ms` that is NaN, for a plain tween and a target tween alike. Before, the tween started and its first frame threw out of the animator's frame, stopping every other animation on every frame after.
  - `animator.stagger` throws a `RangeError` on a delay that is not finite, a numeric `Infinity` included, before any item starts. Before, that item never fired and the stagger never finished. A delay function is now asked for every index before the first item starts.
  - A node raster host whose page or browser has closed opens a new one for its next render, where it failed every render after.
- 7924629: Fixes to timeline seeks, the animator's frames, IK input, the audio scheduler and pattern player, and the node raster host.
  
  - A timeline seek past `duration` with laps left lands in the later lap at once: `time()` reads the time in that lap and its sampled tracks show it before the next frame. Before, `time()` read the raw time until the next frame, and a finished timeline that `setLoop` had given laps stayed past its end for good. A seek to the end samples at once too.
  - `hostAnimator`'s `tick` and `follow` throw `RangeError` on a time or rate that is not finite. Before, one such frame left every animation's time NaN and the animator stuck mid-frame.
  - `solveIk` throws `RangeError` on a `target`, `tip` or `pole` that is not finite, where it returned a pose with every chain joint's rotation NaN.
  - A decay on a target with `friction: 1` throws saying a coast on a target needs friction below 1, where it threw about damping the caller never gave. `DecayOptions.friction` documents its range as (0, 1].
  - A scheduled callback that stops and starts the audio scheduler no longer leaves two pass timers running, each firing every pass, one of them past the next `stop`.
  - A pattern player stopped and started again from its own `onStep` plays once from the new start. Before, the step it was on also booked its next step, so two step chains ran over one count.
  - `VoiceHandle.stop(fadeMs)` throws `RangeError` on a fade that is not finite, before touching the voice. Before, an infinite fade threw from the AudioParam and left the voice playing but marked as fading.
  - Every audio param write refuses a value or ramp that is not finite before canceling what is scheduled, so a refused write keeps the ramp in flight. A reverb or delay's `setMix` and `setFeedback` keep their old value when the write is refused.
  - A node raster host whose page crashed opens a new page for the next render. A crashed page stays open, so every render after it failed.
- Updated dependencies [db5276d]
- Updated dependencies [0e5661d]
- Updated dependencies [30dd2dc]
- Updated dependencies [b188aea]
- Updated dependencies [07205dd]
  - @weasel-js/clock@1.18.2
  - @weasel-js/react@1.18.2
  - @weasel-js/paint@1.18.2
  - @weasel-js/registry@1.18.2
  - @weasel-js/geom@1.18.2

## 1.18.1

### Patch Changes

- @weasel-js/clock@1.18.1
  - @weasel-js/geom@1.18.1
  - @weasel-js/paint@1.18.1
  - @weasel-js/react@1.18.1
  - @weasel-js/registry@1.18.1

## 1.18.0

### Patch Changes

- a78c393: - A nested timeline's `duration` now ends it: its events past that time no longer fire or book, and its sampled tracks hold where they stand at it, as a root timeline does at its own.
  - A timeline seeked from inside an event's handler goes on from where the seek landed: the rest of the span the frame crossed no longer fires, the events after the seek fire on the replay, and a seek from the last edge no longer calls `onDone` early or skips it at the end of the replayed pass.
  - `TimelineHandle.seek` throws a `RangeError` on NaN or an infinite time, which used to leave the timeline stuck.
  - `easeInSine` and `easeInBack` now return exactly 1 at t=1, and `easeOutBack` exactly 0 at t=0, so a tween with a discrete `interpolate` lands on `to`.
- 229d0e7: `setWeights` weighs a joint named like an `Object.prototype` member (`constructor`, `toString`) as its own joint, where it used to drop it and write the weights onto the prototype's function; `dropSkinJoints` hands back the same skin for such a name when the skin does not weigh it.
  Canceling a `cycleVertexColors` cycle leaves alone an override set on the same node and channel since, and a second cancel does nothing.
  A release of a pointer the recognizer never saw pressed no longer ends the multitouch gesture the held fingers are making.
  `keySpecFromKey` and `keySpecFromCode` print a key named like an `Object.prototype` member as itself rather than throwing or answering a function, and `key('constructor+K')` throws as for any unknown modifier.
  kernel3d's pick and snap indexes share one box-validity test and one padding.
- Updated dependencies [fe6a382]
- Updated dependencies [b7ef242]
- Updated dependencies [206b78d]
- Updated dependencies [b4163e6]
- Updated dependencies [a78c393]
- Updated dependencies [cfe8a8a]
- Updated dependencies [6cd51e2]
- Updated dependencies [b93c1dd]
- Updated dependencies [d83476e]
- Updated dependencies [89b2c65]
- Updated dependencies [1e0adbb]
- Updated dependencies [2455bb4]
- Updated dependencies [e3ce292]
  - @weasel-js/paint@1.18.0
  - @weasel-js/geom@1.18.0
  - @weasel-js/react@1.18.0
  - @weasel-js/clock@1.18.0
  - @weasel-js/registry@1.18.0

## 1.17.3

### Patch Changes

- f9e1b14: `@weasel-js/core` and `@weasel-js/animator` take `@msb235/blits` as a peer dependency at `^1.1.0` instead of a dependency pinned at exactly `1.1.0`. An app on any blits 1.x from 1.1.0 up now shares its own copy with weasel instead of getting a second one nested inside it. npm installs the peer automatically; an app that installs blits itself keeps the version it chose.
- Updated dependencies [13c6f66]
  - @weasel-js/geom@1.17.3
  - @weasel-js/clock@1.17.3
  - @weasel-js/paint@1.17.3
  - @weasel-js/react@1.17.3
  - @weasel-js/registry@1.17.3

## 1.17.2

### Patch Changes

- 3dfa153: Pin `@msb235/blits` at exactly `1.1.0` again, in place of 1.17.1's `^1.0.0`. An app taking blits as a `^1` range still shares this one copy with weasel.
- Updated dependencies [32e0dd5]
- Updated dependencies [3dfa153]
- Updated dependencies [4eaadcc]
- Updated dependencies [dd926dc]
- Updated dependencies [019b877]
- Updated dependencies [47679f8]
- Updated dependencies [33c0cbd]
- Updated dependencies [90024bc]
- Updated dependencies [df46c46]
- Updated dependencies [ffacbd8]
  - @weasel-js/paint@1.17.2
  - @weasel-js/clock@1.17.2
  - @weasel-js/geom@1.17.2
  - @weasel-js/react@1.17.2
  - @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- f45b9b5: Take `@msb235/blits` as `^1.0.0` instead of pinning `0.20.0` exactly, so an app on blits 1.x shares one copy with weasel rather than installing a second beside it. blits 1.0.0's one breaking change reserves the shader-patch name `lag`, which weasel does not use.
- Updated dependencies [f45b9b5]
  - @weasel-js/clock@1.17.1
  - @weasel-js/geom@1.17.1
  - @weasel-js/paint@1.17.1
  - @weasel-js/react@1.17.1
  - @weasel-js/registry@1.17.1

## 1.17.0

### Patch Changes

- 38e8c77: `useAnimator` whose `clock` was taken away measured its next frame from the clock's last time, on another timeline: running animations then jumped, most often straight to their ends. It now starts again from where the clock left it, as it already did on a new clock.
- 986134b: A spring handed to the compositor on a target with angle axes turned the long way round to its destination, where the same spring on the main thread takes the short way.
- a7f57b8: A run handed to the compositor and taken back while it played backward committed where it stood, rather than keeping its destination committed as a run on the main thread does. A `target.commit(target.committed())` then jumped the element to the destination, and a tween started on it then landed in the wrong place.
- b0c009e: A run handed to the compositor ended at its destination whenever the browser animation finished, even where the animator's own clock was short of the end, as after time hidden, which the browser counts and the animator does not. It now ends by its own clock and places the browser animation back where that clock stands. Reversed between the browser finishing it and the frame that follows, it no longer jumps to its start.
- f7dc7c8: A run handed to the compositor came back from a hidden page wrong. Its clock dropped all the time since it was last read rather than only the time hidden, then stood still until the browser animation finished, so `read()` and `live()` reported a frozen value while the element moved; the browser animation was not placed back on the animator's clock; and a read while the page was hidden counted the hidden time. `useVisibleRaf` takes an `onSuspend` beside `onResume`, and `hostAnimator`'s handle a `suspended()`, which the animator uses to stop counting.
- 46a7b46: A tween on a target given `interpolate` or `interpolator`, played backward to its start while a hold or another animation still moved the target, left the target off its start by the last frame's step, for good where nothing else asked for a frame.
- b5cd64f: A spring or physics animation handing values to `onTick` with a mass of 0 or below, a negative damping or stiffness, or a constant that is NaN, ran on for good, ticking NaN or a value running away. It now throws, as the same constants on a target do. A decay with `friction` outside (0, 1] throws saying so, where 0 threw an error from deep inside the engine and above 1 sped up for good.
- ceb8c55: A tween or spring on a target whose setter threw as it started left the target counted as moving for good: `target.active` stayed true, and another animator was refused it. The target is now let go before the error reaches the caller.
- efcc47a: A target whose `show` threw stopped the animator's frame loop, freezing every animation it ran, on every target. The error is now logged and what moves that target is stopped, as a tick that throws retires its animation, and the rest play on.
- d28ff77: Depends on `@msb235/blits` 0.20.0, up from 0.18.0. Neither release breaks anything the kit calls. Among their fixes: a seek back over children that a forward seek passed plays them in order again on the next frame, `inert` no longer reads true after a seek back while a staggered subject still has motion to come, so a frame loop sleeping on it wakes, and a child whose rate is written every frame keeps a bounded history instead of one entry per write.
- 34203da: Hand animator runs on DOM elements to the browser's compositor, when the caller asks. `createElementTarget({ element, style, value })` makes a target shown as an element's inline style; a `tween`, `spring`, `decay`, or `physics` given `compositor: 'auto'` that runs alone on one, has no `onTick`, and whose style is only `transform`, `translate`, `rotate`, `scale`, and `opacity` is sampled into keyframes and handed to `Element.animate`, so it costs the main thread nothing per frame. The animator's clock stays in charge: pause, resume, time scale, reversal, an outside clock's seeks, and time spent hidden all re-place the browser animation, and a cancel commits where it stands. Another animation or hold on the target takes the run back to the main thread, where the two add. A new `compositor: 'off' | 'auto' | 'require'` option on every target animation chooses; it defaults to `'off'`, since past a few thousand elements the compositor can be the slower path, by a margin that depends on the machine and the main thread's load. `'require'` throws saying why a run cannot be handed off, and `animator.live()` marks handed-off rows `compositor: true`. Additive: nothing changes for existing targets.
- df080bc: `<SceneViewCanvas worker>` paints its scene from a worker. The component hands its canvas to the worker with `transferControlToOffscreen`, and on each frame sends it only what changed: the changed nodes in their saved form, the pose overrides, and the view, size, and layer settings. The worker keeps its own copy of the scene and draws it with its own renderer. Hit-testing, input, and overlays stay on the page. The worker's module imports `serveSceneRender` from the new `@weasel-js/core/render-worker` entry and registers whatever paints a node there: node shapes, fonts, paint kinds, shader programs (GLSL, WGSL, or both), and the scene registry. `alphaFor` still applies: the page calls it and sends the alphas that changed, and scroll offsets cross too. `workerRef` gives `snapshot()` in place of `toBlob`, which a transferred canvas no longer allows. A host that is not React drives `startSceneRenderWorker` from its own frame loop.
  
  The worker runs no loop of its own: it paints when the page's frame loop sends a frame, so it paints nothing while the canvas is off screen or the tab is hidden. A worker decodes raster images itself, and asks the page for an SVG source, which needs an `<img>` to rasterize.
  
  The renderer's `canvas` option takes an `OffscreenCanvas`. The image cache's own loader decodes rasters with `fetch` and `createImageBitmap` where there is no `<img>`, and `setImageLoader` replaces it. A worker's `self.fonts` loads invalidate glyphs the way `document.fonts` loads do.
  
  A worker view runs its own animator. The worker module registers animation programs by key (`serveSceneRender({ animations })`), and the page plays them through `workerRef.current.animator.play(key, params)` and steers them by id or key; their vertex-color and trim overrides paint as an `animator` does on the page. The animator moves on the page's frames, so it stops while the canvas is unseen, and given `clock` it follows a page clock: its pause holds the animations, and a seek back plays them backward. `hostAnimator` in `@weasel-js/animator` is that animator for any host that runs its own frames.
  
  An image node can draw a `bitmapSrc` bitmap in a worker view: the worker asks the page for it and is sent a copy. `bitmapSrc` names now carry a token of the realm that minted them, and `adoptBitmapSrc` puts a bitmap minted in another realm into the image cache under its name.
  
  `<SceneCanvas worker>` paints the scene layers from a render worker and the rest of the layer stack on the page: the layers below the scene and above it (grid, ghosts, selection and path-edit chrome, consumer layers) each paint into a page canvas of their own, stacked with the worker's, and the top one takes input. A page layer placed between two scene layers gives each part of the scene its own worker. The handle's `readIds` and `pickAt` read every canvas of the stack, the worker's a round trip away and in the page's `scenePickIds` numbering, and `readIdsSync` answers `null` there, so `geometry.picking: 'pixels'` walks the shapes. A prop worker mode cannot honor is a type error: `animator`, `paintInto`, `inputElement`, `backend`, and a scene slot's functions; the worker's canvas and the page's beside it paint with WebGL 2. The handle's `worker` gives the worker's animator and a snapshot of the whole stack.
  
  This changes `SceneCanvasProps` and `SceneViewCanvasProps` into unions of a page-painted and a worker-painted branch, which breaks a wrapper that writes `Omit<SceneCanvasProps<…>, K>`: an `Omit` of a union merges its branches, and the merged props are assignable to neither. Distribute it instead, `SceneCanvasProps<…> extends infer P ? (P extends unknown ? Omit<P, K> : never) : never`, as `LeanSceneCanvasProps` and labkit's `TrialSceneCanvasProps` now do. `SceneViewCanvas` also takes `dpr`.
- Updated dependencies [f7dc7c8]
- Updated dependencies [d28ff77]
- Updated dependencies [9e2e425]
- Updated dependencies [5067c7a]
- Updated dependencies [561550a]
- Updated dependencies [6539d70]
- Updated dependencies [b497b07]
- Updated dependencies [75ef6d9]
- Updated dependencies [12e9c39]
- Updated dependencies [9d25103]
- Updated dependencies [3b08834]
- Updated dependencies [ceff0c3]
- Updated dependencies [52fd33e]
- Updated dependencies [454e8e1]
  - @weasel-js/react@1.17.0
  - @weasel-js/clock@1.17.0
  - @weasel-js/geom@1.17.0
  - @weasel-js/paint@1.17.0
  - @weasel-js/registry@1.17.0

## 1.16.2

### Patch Changes

- 65d2e7c: Depends on `@msb235/blits` 0.18.0, up from 0.16.1. Neither release breaks anything the kit calls. Among their fixes: a seek back now finds a voice that an earlier forward seek played to its end, so scrubbing back over a finished effect shows it again; and a voice's `seek` throws a `RangeError` for a time that is not a finite number, where a `NaN` time used to leave the voice showing nothing.
- Updated dependencies [944faa2]
- Updated dependencies [847875c]
  - @weasel-js/geom@1.16.2
  - @weasel-js/clock@1.16.2
  - @weasel-js/paint@1.16.2
  - @weasel-js/react@1.16.2
  - @weasel-js/registry@1.16.2

## 1.16.1

### Patch Changes

- Updated dependencies [3afef45]
- Updated dependencies [5a2e82a]
- Updated dependencies [25a1ff7]
  - @weasel-js/geom@1.16.1
  - @weasel-js/registry@1.16.1
  - @weasel-js/clock@1.16.1
  - @weasel-js/react@1.16.1
  - @weasel-js/paint@1.16.1

## 1.16.0

### Patch Changes

- 63056ee: A stroke can now draw only part of its path. `Stroke.trim` is a `StrokeTrim`, `{ start?, end?, pace? }`, and the stroke draws the stretch between `start` and `end` in the order the path was authored. Each edge is a `TrimAt`: a bare number is a fraction of the whole path, `{ length }` an absolute distance, `{ anchor }` a vertex index (`2.5` is halfway along the segment after anchor 2) and `{ subpath }` a subpath index. `pace` (`TrimPace`) says what a fraction is a fraction of: `'length'` (the default) moves at constant speed, and `'anchor'` gives every segment an equal share. An edge omitted is the path's start or end, and a window whose start is at or past its end draws nothing. Lengths are exact arc lengths in the path's own space, so the cut doesn't move with zoom or flattening tolerance. Tween `end` from 0 to 1 to draw a line on, then `start` after it to draw it off.
  
  `markerStart` and `markerEnd` sit at each visible run's ends, so an end arrow rides the growing line; a run cut from a closed subpath takes neither. `markerMid` shows on the vertices inside the window. Dashes keep the pattern the untrimmed stroke has, so drawing on reveals the pattern rather than sliding it. Picking hits only the visible part of the stored trim. SVG and PDF export write the visible geometry, with curves split rather than flattened. SVG also writes `stroke-dashoffset` where a run starts mid-pattern. Import recovers no trim. Outlined text ignores its stroke's trim, since each glyph is stroked on its own.
  
  To animate a trim without ops or undo, `Animator.trimOverrides` is a `TrimOverrideRegistry` (with `TrimOverride` and `TrimEdge`), read at draw time the way vertex-color overrides are. `<SceneCanvas animator>`, `<SceneViewCanvas animator>` and `MinimapCanvas` paint it and repaint when an override is set or cleared. `renderSceneToCanvas`, `renderSceneToPixels` and `createPathLayer` take `trimOverrides` beside `colorOverrides`. core exports both as one `PaintOverrides` type, which each of those argument types extends. `NodePaintCtx.trim` and `NodeInk.trim` carry a node's trim to its painter. In diagrams, `EdgeStyle.trim` trims an edge, and `DiagramViewProps.animator` animates it by the edge's scene node id. The draw.io, Mermaid and DOT writers warn when they drop a trim, and the scene reader reads it back.
  
  New exports:
  
  - paint: `StrokeTrim`, `TrimAt`, `TrimPace` and `strokeTrimKey`, a stable cache key per trim. core re-exports the three types.
  - geom: `lengthTable`, `pathLengthTable`, `LengthTable`, `LengthRun`, `LengthSpan`, `lengthAtAnchor`, `anchorAtLength`, `lengthAtSubpath`, `lengthAtSegmentFraction`, `closingAnchor` and `pointAtLength`: exact pen-order arc length over 2D or 3D runs of lines and Bézier curves. Also `curveSpan`, `lengthAtCurve`, `runSegments`, `CurvePosition` and `CurveSpan`, which name a place on a path as a segment and curve parameter so every flattening cuts at the same point. Also `segmentLength(coords, dim, a?, b?)` and `segmentTAtLength(coords, dim, length, total?)` over flat control points, and the new fields `StrokeHitTestOptions.span` and `Polyline.closeAnchor`. In `geom/tessellate`: `polylineAtCurve` and `PolylinePlace`. In `geom/3d`: `pointAtLength3`.
  - stroke: `resolveTrim`, `trimSpan`, `trimmedPath`, `TrimmedPath`, `trimmedRuns` and `TrimmedRun`. `splitForDash` takes an optional `phase`.
  - animator: `ColorOverrideRegistry.subscribe`.
  - svg: `SvgStroke.trim` and `SvgStroke.dashOffset`. svg now depends on `@weasel-js/stroke`.
  
  Breaking and behavior changes:
  
  - `buildSceneViewCommands` (core) takes a `PaintOverrides` object as its seventh argument instead of a `ColorOverrideRegistry`. Pass `{ colorOverrides }` where you passed the registry.
  - `ColorOverrideRegistry.has(id)` (animator) no longer counts a target that was asked for and never moved. It is true only for an override from `set`, or for a target an animation has committed.
  - `measurePath` and `pointAlongPath` (geom) now measure exact arc length rather than a flattening. Lengths and points move by up to a few hundredths of a unit on curved paths, and a label at 0.5 now sits where a trim at 0.5 cuts. `flattenTolerance` now affects only the headings and the `nearest` search.
  - Rounded corners are measured by their exact arc length rather than by a fixed 32-step table, so corner segment lengths change slightly.
  - `pathThroughPoseFrame` (geom) rounds a path's `corners` before applying a stretch or skew, as the renderer does, and returns them already rounded. A uniform frame still keeps them as corners.
  - `extractPolylines` records, in `closeAnchor`, the anchor of a closing point it drops as a duplicate of the first.
  - Diagram edges whose style sets no width now draw at `EDGE_STROKE_WIDTH`, 1.5, instead of 2 (`DEFAULT_EDGE_STROKE` and `themeEdgeStroke`).
  - `svgPaintFromKit`, `svgStrokeFromKit` and `SvgKitPose` moved to their own module in svg; they are still exported from the package root.
- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/paint@1.16.0
  - @weasel-js/geom@1.16.0
  - @weasel-js/clock@1.16.0
  - @weasel-js/react@1.16.0
  - @weasel-js/registry@1.16.0

## 1.15.2

### Patch Changes

- a4138b6: `@weasel-js/geom` states the nearest point of a segment, point distance and lerp once, in any
  dimension, and every tier answers through that one rule.
  
  - `@weasel-js/geom/nd` adds `segmentT`, `closestPointOnSegment`, `pointSegmentDist`,
    `pointSegmentDist2`, `distance`, `distance2` and `lerp` over plain number arrays.
  - The root barrel adds `segmentT` and `pointSegmentDist` over loose scalars, which allocate nothing,
    beside the existing `pointSegmentDist2`; `distance`, `distance2` and `lerpPoint` over `Point`; and a
    scalar `lerp`.
  - `@weasel-js/geom/3d`'s `closestPointOnSegment` and `lerp` now go through the same rule, so a planar
    problem gets the same numbers in 2D, 3D and `nd`.
  
  A segment's parameter is clamped to [0, 1] and is 0 on a zero-length segment; at `t = 1` the nearest
  point is the far end exactly. `nearestOnLine` and the private copies in core's measurement hit test,
  animator's auto-skinning, diagram's route and label code, stroke's edge test, path-tools'
  extend-to-meet and guides' layout snaps now call these, so their distances can move by a rounding
  step (`Math.hypot` became a square root of the summed squares).
  
  Corner shapes (`cornerShapePieces`) now fit the true superellipse within `CORNER_FIT_TOLERANCE` for
  every finite `k`. Past `|k| ≈ 9` they strayed up to nine times the tolerance off the curve's straight
  legs, because the fit stepped in an angle that crowds those legs into less than a double resolves;
  it now steps evenly along each leg. The same corners draw with about a third fewer cubics.
- Updated dependencies [507f539]
- Updated dependencies [c6edab2]
- Updated dependencies [a4138b6]
- Updated dependencies [5a0375b]
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
- Updated dependencies [6544399]
- Updated dependencies [5f6111b]
  - @weasel-js/paint@1.15.2
  - @weasel-js/geom@1.15.2
  - @weasel-js/react@1.15.2
  - @weasel-js/registry@1.15.2
  - @weasel-js/clock@1.15.2

## 1.15.1

### Patch Changes

- 2992b55: Dependency updates: `@msb235/blits` 0.16.1 (core, animator, clock, labkit), `earcut` 3.2.4 (core, geom's peer
  range, labkit), `react-aria` 3.53.1 and `react-aria-components` 1.22.1 (ui), and `magic-string` 1.4.5, `oxc-parser`
  0.156.0 and `unplugin` 3.7.0 (icons-plugin). geom's `earcut` peer is an exact pin, so a consumer installing geom
  beside its own `earcut` needs 3.2.4.
- Updated dependencies [2992b55]
  - @weasel-js/geom@1.15.1
  - @weasel-js/clock@1.15.1
  - @weasel-js/paint@1.15.1
  - @weasel-js/react@1.15.1
  - @weasel-js/registry@1.15.1

## 1.15.0

### Patch Changes

- Updated dependencies [b7d362d]
- Updated dependencies [a95d3a4]
- Updated dependencies [30bf607]
- Updated dependencies [48b6c4c]
- Updated dependencies [fce0494]
  - @weasel-js/geom@1.15.0
  - @weasel-js/clock@1.15.0
  - @weasel-js/paint@1.15.0
  - @weasel-js/react@1.15.0
  - @weasel-js/registry@1.15.0

## 1.14.2

### Patch Changes

- Updated dependencies [4bba14d]
  - @weasel-js/registry@1.14.2
  - @weasel-js/clock@1.14.2
  - @weasel-js/react@1.14.2
  - @weasel-js/geom@1.14.2
  - @weasel-js/paint@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/clock@1.14.1
  - @weasel-js/geom@1.14.1
  - @weasel-js/paint@1.14.1
  - @weasel-js/react@1.14.1
  - @weasel-js/registry@1.14.1

## 1.14.0

### Patch Changes

- cc0e73a: `useAnimator` takes an optional `clock`, a `ClockHandle` from `@weasel-js/clock`. Given one, the animator runs no frame loop of its own: it advances when the clock moves, reading its time from the clock, so the clock's pause, rate, seeking, `holdAt` and visibility gating govern it, and the host's `useClockLoop` syncs it. When the clock goes back, by a seek or a negative rate, the running animations play backward to the time it stands at; one that has ended meanwhile, at its end or back at its start, does not come back. Without a clock nothing changes. This adds API.
- a58fb4f: Every reader of a `PolygonPath`'s coords now reads them where its `origin` puts them: hit-testing and marquee/lasso picking, distance, anchors (`pathToAnchors`, anchor editing, corner expansion and restore), the booleans, `pathToD` and SVG export, cubic contours, puppet meshes, pose interpolation, derived parts, path warps, diagram connectors, and skinning. `translatePath` and `rotatePathAround` move the origin rather than the coords, and `anchorsToPath` given `like` writes back from its origin. This adds API: `worldCoords`, `pathPoint`, `originOf`, `addOrigin` and `coordsFrom` read and write coords in a path's own space.
  
  Paths far from 0 now get an origin where they are made: past `ORIGIN_THRESHOLD` (16,384), `anchorsToPath` without `like` (the pen tool), `pathFromD`, the booleans, and SVG import measure the path from `originFor`, the rounded center of its points. `PathBuilder.autoOrigin()` and `transformPath`'s `{ autoOrigin: true }` opt a producer in. A path near 0 is built as before.
- Updated dependencies [e1bbdcd]
- Updated dependencies [9912c13]
- Updated dependencies [3d36f5e]
- Updated dependencies [e974dba]
- Updated dependencies [30582cb]
- Updated dependencies [2999820]
- Updated dependencies [b142892]
- Updated dependencies [6d5f7c2]
- Updated dependencies [14f8583]
- Updated dependencies [783756a]
- Updated dependencies [b0a55a6]
- Updated dependencies [e7fca17]
- Updated dependencies [a58fb4f]
- Updated dependencies [8e6ed97]
- Updated dependencies [6b1b532]
- Updated dependencies [9ef7751]
- Updated dependencies [34a364e]
- Updated dependencies [2e4943e]
- Updated dependencies [8e2c8c8]
- Updated dependencies [4f68c3a]
- Updated dependencies [78213f7]
- Updated dependencies [0fc0e50]
- Updated dependencies [dc6f83a]
- Updated dependencies [97d889f]
- Updated dependencies [9adc0cd]
- Updated dependencies [24e03ff]
- Updated dependencies [b43c94c]
- Updated dependencies [dfdc8a6]
- Updated dependencies [e23101b]
  - @weasel-js/paint@1.14.0
  - @weasel-js/clock@1.14.0
  - @weasel-js/geom@1.14.0
  - @weasel-js/react@1.14.0
  - @weasel-js/registry@1.14.0

## 1.13.0

### Patch Changes

- 38d5ad1: Depend on `@msb235/blits` 0.12.0, which has no breaking changes from 0.11.0. Its fixes make a single `fn` voice over many subjects, the shape weasel's animator uses, cheaper per frame.
- Updated dependencies [7e5f9e3]
- Updated dependencies [c7516cd]
- Updated dependencies [8c39126]
- Updated dependencies [769eef8]
- Updated dependencies [4c113da]
  - @weasel-js/geom@1.13.0
  - @weasel-js/paint@1.13.0
  - @weasel-js/react@1.13.0
  - @weasel-js/registry@1.13.0

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
