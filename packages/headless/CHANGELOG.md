# @weasel-js/headless

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
- Updated dependencies [8048831]
- Updated dependencies [e4b64b6]
- Updated dependencies [895ed9b]
- Updated dependencies [0c77d00]
- Updated dependencies [fc38c90]
- Updated dependencies [389a7f9]
- Updated dependencies [7457319]
- Updated dependencies [0e5661d]
- Updated dependencies [707636a]
- Updated dependencies [30dd2dc]
- Updated dependencies [d16f1ca]
- Updated dependencies [cd61bfa]
- Updated dependencies [d373a31]
- Updated dependencies [07205dd]
- Updated dependencies [5d2451b]
- Updated dependencies [800c96b]
- Updated dependencies [8d97dd3]
  - @weasel-js/core@1.18.2
  - @weasel-js/geom@1.18.2

## 1.18.1

### Patch Changes

- Updated dependencies [7a33153]
- Updated dependencies [f2a1845]
- Updated dependencies [7537af5]
- Updated dependencies [f4d2261]
- Updated dependencies [112f6bb]
- Updated dependencies [860ab3b]
  - @weasel-js/core@1.18.1
  - @weasel-js/geom@1.18.1

## 1.18.0

### Patch Changes

- b4163e6: Fix visibility gating, a leaked browser context and screen-space tiling.
  
  - `useVisibleRaf` reads the newest of the reports an `IntersectionObserver` delivers together for its target, so an element that entered and left the viewport between two callbacks no longer reads as visible, and a report still queued for a replaced target no longer gates the new one.
  - `useVisibleRaf` runs a request it held while suspended as soon as `dangerouslyRunWhenHidden` is set, instead of waiting for the document to show again.
  - A node raster host given a `browser` closes the context it opened there when the page script fails to start.
  - `createTiledLayer` draws its `space: 'screen'` sources in screen space, rather than scaled by the zoom and moved by the pan.
- Updated dependencies [4161bcd]
- Updated dependencies [fe6a382]
- Updated dependencies [b7ef242]
- Updated dependencies [c7e8680]
- Updated dependencies [c148384]
- Updated dependencies [206b78d]
- Updated dependencies [e405e70]
- Updated dependencies [a78c393]
- Updated dependencies [c02f028]
- Updated dependencies [0f72734]
- Updated dependencies [cfe8a8a]
- Updated dependencies [082fa2f]
- Updated dependencies [324322e]
- Updated dependencies [b93c1dd]
- Updated dependencies [12c538a]
- Updated dependencies [14aa7a8]
- Updated dependencies [b53a3ef]
- Updated dependencies [67d207f]
- Updated dependencies [bdf1a62]
- Updated dependencies [b616cad]
- Updated dependencies [89b2c65]
- Updated dependencies [27d8adb]
- Updated dependencies [02eb957]
- Updated dependencies [5dbf225]
- Updated dependencies [2455bb4]
- Updated dependencies [e3ce292]
- Updated dependencies [a1f2242]
  - @weasel-js/core@1.18.0
  - @weasel-js/geom@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [f9e1b14]
- Updated dependencies [49cd9bb]
- Updated dependencies [13c6f66]
- Updated dependencies [778f26d]
- Updated dependencies [56446ad]
  - @weasel-js/core@1.17.3
  - @weasel-js/geom@1.17.3

## 1.17.2

### Patch Changes

- Updated dependencies [d15e917]
- Updated dependencies [3dfa153]
- Updated dependencies [36a16c0]
- Updated dependencies [2e4ad49]
- Updated dependencies [883dfcd]
- Updated dependencies [54dc458]
- Updated dependencies [dd926dc]
- Updated dependencies [cda0a20]
- Updated dependencies [d162fbb]
- Updated dependencies [f15f881]
- Updated dependencies [35c291a]
- Updated dependencies [e13e539]
- Updated dependencies [2121adb]
- Updated dependencies [b81f560]
- Updated dependencies [060b0ee]
- Updated dependencies [caf38d2]
- Updated dependencies [33c0cbd]
- Updated dependencies [90024bc]
- Updated dependencies [03f87f4]
- Updated dependencies [2af51ff]
  - @weasel-js/core@1.17.2
  - @weasel-js/geom@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [f45b9b5]
- Updated dependencies [629d02b]
  - @weasel-js/core@1.17.1
  - @weasel-js/geom@1.17.1

## 1.17.0

### Patch Changes

- Updated dependencies [d28ff77]
- Updated dependencies [217246e]
- Updated dependencies [a161c0b]
- Updated dependencies [34f7531]
- Updated dependencies [bf27898]
- Updated dependencies [533bb6a]
- Updated dependencies [436da9e]
- Updated dependencies [3c517d9]
- Updated dependencies [7e3d359]
- Updated dependencies [6539d70]
- Updated dependencies [c5f7685]
- Updated dependencies [7c26f2b]
- Updated dependencies [ce7e8b5]
- Updated dependencies [b497b07]
- Updated dependencies [75ef6d9]
- Updated dependencies [12e9c39]
- Updated dependencies [9d25103]
- Updated dependencies [3b08834]
- Updated dependencies [ceff0c3]
- Updated dependencies [d5cc782]
- Updated dependencies [ee9bc7f]
- Updated dependencies [0af766f]
- Updated dependencies [e989ef7]
- Updated dependencies [e6cf896]
- Updated dependencies [2ebc73f]
- Updated dependencies [b606ef9]
- Updated dependencies [8e888a9]
- Updated dependencies [5f43e16]
- Updated dependencies [71f0ad6]
- Updated dependencies [454e8e1]
- Updated dependencies [e78e03c]
- Updated dependencies [70113d3]
- Updated dependencies [d90931a]
- Updated dependencies [84a8be0]
- Updated dependencies [59ddef2]
- Updated dependencies [df080bc]
  - @weasel-js/core@1.17.0
  - @weasel-js/geom@1.17.0

## 1.16.2

### Patch Changes

- Updated dependencies [65d2e7c]
- Updated dependencies [db1eb4e]
- Updated dependencies [944faa2]
- Updated dependencies [6c0b311]
- Updated dependencies [f6f69c8]
- Updated dependencies [8f2e1e1]
- Updated dependencies [12d3c17]
- Updated dependencies [6e3b081]
- Updated dependencies [847875c]
- Updated dependencies [12caf33]
- Updated dependencies [f285e56]
- Updated dependencies [6ecee1a]
  - @weasel-js/core@1.16.2
  - @weasel-js/geom@1.16.2

## 1.16.1

### Patch Changes

- Updated dependencies [3afef45]
- Updated dependencies [071906a]
- Updated dependencies [214d5d5]
- Updated dependencies [9533421]
- Updated dependencies [6b9d157]
- Updated dependencies [603dbc3]
- Updated dependencies [5a2e82a]
- Updated dependencies [07a8387]
- Updated dependencies [72330bf]
- Updated dependencies [3905b08]
- Updated dependencies [25a1ff7]
- Updated dependencies [6b503a5]
- Updated dependencies
  - @weasel-js/geom@1.16.1
  - @weasel-js/core@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/geom@1.16.0
  - @weasel-js/core@1.16.0

## 1.15.2

### Patch Changes

- Updated dependencies [946faff]
- Updated dependencies [507f539]
- Updated dependencies [c6edab2]
- Updated dependencies [a4138b6]
- Updated dependencies [5a0375b]
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
- Updated dependencies [2f6b10d]
- Updated dependencies [5f6111b]
  - @weasel-js/core@1.15.2
  - @weasel-js/geom@1.15.2

## 1.15.1

### Patch Changes

- 13b0604: Breaking: `@weasel-js/headless` now holds what was announced as `@weasel-js/node-render`, which never published under that name. Its 1.15.0 contents (list, focus, slider, reorder and tree keys, and the measure/draw contract) moved to `@weasel-js/ui-logic` unchanged; import them from there.
  
  What the package does now: render a scene to pixels from Node. `createNodeRasterHost()` runs core's `renderSceneToPixels` in a headless Chromium page launched through `playwright-core` on the first render, and keeps that page, its WebGL2 context and its GPU caches across renders until `dispose()`. `render` returns the raw straight-RGBA raster and `renderPng` a PNG; the scene goes in live or as its `toJSON()` snapshot, with its paths' typed arrays tagged on the way. `@weasel-js/headless/page` is the page's script, for a consumer bundling its own page to register fonts or painters first. The browser itself is not bundled: install it with `npx playwright install chromium`.
- Updated dependencies [424ba52]
- Updated dependencies [9515681]
- Updated dependencies [5e66a10]
- Updated dependencies [2992b55]
- Updated dependencies [8ad43af]
- Updated dependencies [120420a]
- Updated dependencies [e982d8a]
  - @weasel-js/core@1.15.1
  - @weasel-js/geom@1.15.1
