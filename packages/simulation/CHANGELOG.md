# @weasel-js/simulation

## 2.0.0

### Major Changes

- 29135cb: `Simulation` is now the type `createSimulation` returns, and the frame-loop handle `useSimulation` returns is `RunningSimulation`.
  
  The old `SimulationCore` is `Simulation`, and the old `Simulation` is `RunningSimulation`. `@weasel-js/core/math` re-exports both under the new names.
  
  ```ts
  // before
  const core: SimulationCore<N> = createSimulation({ nodes });
  const sim: Simulation<N> = useSimulation({ nodes });
  // after
  const core: Simulation<N> = createSimulation({ nodes });
  const sim: RunningSimulation<N> = useSimulation({ nodes });
  ```
  
  <!-- entry: breaking api -->

### Patch Changes

- bf09aae: A simulation on a clock keeps running when its `onEnd` calls `restart()`, as one on its own frame loop does.
  
  <!-- entry: fix -->
- c6fbf4b: A simulation throws a `RangeError` on a setting or tick count that is not a finite number, as a clock does.
  
  Alpha, its target, decay and minimum, velocity decay, and `tick`'s count are checked, at creation and when set.
  
  <!-- entry: fix behavior -->
- 88a5b5e: A simulation node pinned to a NaN or infinite `fx` or `fy` holds its place instead of taking that value as its position.
  
  <!-- entry: fix -->
- Updated dependencies [e973dcd]
- Updated dependencies [851a4d3]
- Updated dependencies [d764d06]
- Updated dependencies [a98ad34]
- Updated dependencies [2c2ab71]
- Updated dependencies [4fb8cbf]
- Updated dependencies [9249b26]
- Updated dependencies [ec44e4c]
- Updated dependencies [4f264d0]
- Updated dependencies [af88833]
- Updated dependencies [b29cf9e]
- Updated dependencies [6821bac]
- Updated dependencies [9707f7c]
- Updated dependencies [f88b38b]
- Updated dependencies [b68c9a2]
- Updated dependencies [39f4ad4]
- Updated dependencies [a66885d]
- Updated dependencies [b90239c]
- Updated dependencies [35a99f3]
- Updated dependencies [687d98f]
- Updated dependencies [105a6bf]
- Updated dependencies [c71fb10]
- Updated dependencies [cc3910a]
- Updated dependencies [4f451f8]
- Updated dependencies [29d293c]
- Updated dependencies [c3da788]
- Updated dependencies [ece64a6]
- Updated dependencies [fcc5602]
- Updated dependencies [bfc26b4]
- Updated dependencies [0046729]
- Updated dependencies [fcc5602]
- Updated dependencies [ece64a6]
- Updated dependencies [ece64a6]
- Updated dependencies [b6863aa]
- Updated dependencies [36dac61]
- Updated dependencies [daba59f]
- Updated dependencies [7a053e0]
- Updated dependencies [acb38fe]
- Updated dependencies [644baad]
- Updated dependencies [cbd9a26]
- Updated dependencies [8c2d558]
- Updated dependencies [af85c85]
- Updated dependencies [6a9cd12]
- Updated dependencies [af85c85]
- Updated dependencies [5d79d0e]
- Updated dependencies [43e65cf]
- Updated dependencies [e280844]
- Updated dependencies [f889447]
- Updated dependencies [b9a8c62]
- Updated dependencies [a3caa9d]
- Updated dependencies [1dc92ce]
- Updated dependencies [ced5841]
- Updated dependencies [4949266]
- Updated dependencies [9f6da2d]
- Updated dependencies [15a78d8]
- Updated dependencies [f54c013]
- Updated dependencies [2acda2a]
- Updated dependencies [1cc8fea]
- Updated dependencies [3588b89]
- Updated dependencies [9a45d4a]
- Updated dependencies [4f2ce5c]
- Updated dependencies [4e54b4e]
- Updated dependencies [2b26641]
- Updated dependencies [eec8a23]
- Updated dependencies [353033f]
- Updated dependencies [27f0928]
- Updated dependencies [a3f0833]
- Updated dependencies [0157b15]
- Updated dependencies [4f35254]
- Updated dependencies [0118cd0]
- Updated dependencies [70213a5]
- Updated dependencies [4f9848f]
- Updated dependencies [4c0bb1b]
- Updated dependencies [4dff167]
- Updated dependencies [514f6ad]
- Updated dependencies [d455bd2]
- Updated dependencies [11c9e5f]
- Updated dependencies [241446a]
- Updated dependencies [81cc3f8]
- Updated dependencies [e0a11e4]
- Updated dependencies [e280844]
- Updated dependencies [a7fd87a]
- Updated dependencies [0f0c7e5]
- Updated dependencies [ce89e1f]
- Updated dependencies [c4d419b]
- Updated dependencies [da7dd2e]
- Updated dependencies [8cbcaf4]
- Updated dependencies [2d649c0]
- Updated dependencies [5b84935]
- Updated dependencies [02900a7]
- Updated dependencies [308226e]
- Updated dependencies [b2ecf6d]
- Updated dependencies [8af195e]
- Updated dependencies [7459739]
- Updated dependencies [5d43ec9]
- Updated dependencies [57af464]
- Updated dependencies [a20fc8c]
- Updated dependencies [a2fbf00]
- Updated dependencies [1ad4f25]
- Updated dependencies [1eb7552]
- Updated dependencies [7863d23]
- Updated dependencies [de8f61d]
- Updated dependencies [ec23b4e]
- Updated dependencies [de8f61d]
- Updated dependencies [28b5165]
- Updated dependencies [ff70ebe]
- Updated dependencies [0f43324]
- Updated dependencies [f4b9a4a]
- Updated dependencies [85f85ba]
- Updated dependencies [adb1290]
- Updated dependencies [4f2d1e0]
- Updated dependencies [ece64a6]
- Updated dependencies [9c507b5]
- Updated dependencies [9c507b5]
- Updated dependencies [ff4504e]
- Updated dependencies [58f9d2e]
- Updated dependencies [c67bcfa]
- Updated dependencies [f04bbbc]
- Updated dependencies [0f60e3d]
- Updated dependencies [5124d5a]
- Updated dependencies [0f60e3d]
- Updated dependencies [3207a40]
- Updated dependencies [e49aa18]
- Updated dependencies [70076bc]
- Updated dependencies [6a9a3dc]
- Updated dependencies [3f553ff]
- Updated dependencies [5d75785]
- Updated dependencies [4d31cf0]
- Updated dependencies [af132bc]
- Updated dependencies [2d57c94]
- Updated dependencies [f004638]
- Updated dependencies [3c27e36]
- Updated dependencies [3c27e36]
- Updated dependencies [ce5d609]
- Updated dependencies [dd5a540]
- Updated dependencies [4a4d7c9]
- Updated dependencies [6fcc7aa]
- Updated dependencies [56fda8d]
- Updated dependencies [f88d616]
- Updated dependencies [1c2c1ac]
- Updated dependencies [1d8e163]
- Updated dependencies [e08d172]
- Updated dependencies [429e80c]
- Updated dependencies [002ff57]
- Updated dependencies [7a7ea82]
- Updated dependencies [9521334]
- Updated dependencies [12cfcfc]
- Updated dependencies [415e5b8]
- Updated dependencies [e68cb62]
- Updated dependencies [0ee2887]
- Updated dependencies [767af8a]
- Updated dependencies [fb702eb]
- Updated dependencies [c11f37e]
- Updated dependencies [e39dbc5]
- Updated dependencies [98d2f9a]
- Updated dependencies [cf2ad81]
- Updated dependencies [60c082d]
- Updated dependencies [1e58c0d]
- Updated dependencies [d3b462a]
- Updated dependencies [49f1f5b]
- Updated dependencies [1f05956]
- Updated dependencies [a8efdf5]
- Updated dependencies [774e9cc]
- Updated dependencies [e841e68]
- Updated dependencies [18f7289]
- Updated dependencies [a5caeed]
- Updated dependencies [34b8a3f]
- Updated dependencies [e3148d0]
- Updated dependencies [0d977b8]
- Updated dependencies [5dd240d]
- Updated dependencies [8b01b26]
- Updated dependencies [2c0f2fe]
- Updated dependencies [12816b7]
- Updated dependencies [6803209]
- Updated dependencies [f857c86]
- Updated dependencies [aec0cec]
- Updated dependencies [174070d]
  - @weasel-js/geom@2.0.0
  - @weasel-js/clock@2.0.0
  - @weasel-js/react@2.0.0

## 1.19.1

### Patch Changes

- e17dbd6: A simulation's steps are painted the frame they run, not the frame after.
  
  <!-- entry: fix -->
- Updated dependencies [87bf0a8]
- Updated dependencies [8725f6c]
- Updated dependencies [d5593b2]
- Updated dependencies [1da0762]
- Updated dependencies [9f44d6d]
- Updated dependencies [d11f1df]
- Updated dependencies [2c3416d]
  - @weasel-js/react@1.19.1
  - @weasel-js/clock@1.19.1

## 1.19.0

### Patch Changes

- c7756c5: Alpha decays toward `alphaTarget` without passing it: an `alphaDecay` above 1 acts as 1, and a negative one as 0.
  
  <!-- entry: rank=-5 fix -->
- c7756c5: A simulation stepping on a clock takes the same number of steps over a span of clock time however the frames slice it.
  
  <!-- entry: fix -->
- Updated dependencies [b1309b2]
- Updated dependencies [153719c]
- Updated dependencies [bce00fd]
- Updated dependencies [98a8020]
- Updated dependencies [6d7aae1]
- Updated dependencies [326d7be]
- Updated dependencies [2740ed4]
- Updated dependencies [2f5f287]
  - @weasel-js/clock@1.19.0
  - @weasel-js/react@1.19.0

## 1.18.2

### Patch Changes

- Updated dependencies [db5276d]
- Updated dependencies [0e5661d]
  - @weasel-js/clock@1.18.2
  - @weasel-js/react@1.18.2

## 1.18.1

### Patch Changes

- f2a1845: Fix edge cases in symmetry counts, simulation clocks, tiled layers, and the zoom-to-fit and minimap framing of copies.
  
  - `@weasel-js/symmetry`: a radial, kaleidoscope or repeat group with a huge `count` is now held to `MAX_WALLPAPER_COPIES` copies, as a wallpaper already was. Before, a count of 1e7 built ten million transforms on every draw, and `Infinity` threw. This changes behavior: a count past the limit now draws fewer copies than it asks for, and a NaN count gives a kaleidoscope one wedge (a single mirror) where it used to draw nothing.
  - `@weasel-js/symmetry`: where a short step puts the guide's step handle over the center, the step handle is now drawn on top, since that is the handle a press takes.
  - `@weasel-js/simulation`: changing `useSimulation`'s `clock` no longer restarts a simulation the host stopped, or steps one that has settled. A running simulation carries on, on the new clock.
  - `@weasel-js/parallax`: `createTiledLayer` now applies each source layer's `effects`, once over all of that layer's copies. Before, it dropped them. Sources now also keep their stacking order in every copy, so a later source draws over an earlier one where content bleeds into the next cell. Before, sources were drawn copy by copy.
  - `@weasel-js/minimap`: the fit now goes through core's `fitViewToBounds`. A `{ kind: 'world' }` rect with a side that is not finite now falls back to identity scale, where before it got a scale of zero.
  - `@weasel-js/core`: zoom to fit now frames every copy a `copiesFromPose` group draws, such as a symmetry group's copies. Before, it cut off copies outside the authored content. New export: `sceneContentBounds(scene, boxOf, poseOf?)` returns the world box a scene's content covers, copies included. It's what zoom to fit and the minimap both frame.
  - `@weasel-js/minimap`: the `'scene'` and `'live'` fits now frame the copies a group draws, and leave out hidden nodes, matching zoom to fit.
- @weasel-js/clock@1.18.1
  - @weasel-js/react@1.18.1

## 1.18.0

### Patch Changes

- 7e83b0f: A wallpaper whose extent leaves its center out now draws its cell's copies about the original, as its guide and its edit symmetries already assumed. `useSimulation`'s docs say which options it reads only at mount, and the loupe model's docs spell color the US way.
- Updated dependencies [b4163e6]
- Updated dependencies [6cd51e2]
- Updated dependencies [e3ce292]
  - @weasel-js/react@1.18.0
  - @weasel-js/clock@1.18.0

## 1.17.3

### Patch Changes

- @weasel-js/clock@1.17.3
  - @weasel-js/react@1.17.3

## 1.17.2

### Patch Changes

- 62e6961: A simulation on a clock whose `step` is 0, negative or not a number steps once per frame the clock moves. A `step` of 0 used to owe infinitely many steps on the first frame, which hung the page whenever `alphaTarget` kept the simulation warm, and a negative one owed a negative count.
- 466c30b: `isSettled()` answers true for a simulation whose `alphaTarget` is above 0 but below `alphaMin`, once alpha has fallen below `alphaMin`. The frame loop had already stopped and `onEnd` had fired there, while `isSettled()` kept answering false because it required `alphaTarget` to be exactly 0.
- Updated dependencies [3dfa153]
- Updated dependencies [4eaadcc]
- Updated dependencies [df46c46]
- Updated dependencies [ffacbd8]
  - @weasel-js/clock@1.17.2
  - @weasel-js/react@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [f45b9b5]
  - @weasel-js/clock@1.17.1
  - @weasel-js/react@1.17.1

## 1.17.0

### Patch Changes

- 9778eee: Doc fixes. `useSimulation`'s `onEnd` and `alphaMin` said the loop ends only with `alphaTarget` at 0; it ends, as d3-force's does, once alpha falls below `alphaMin`, whatever the target. `ModeDefinition` counted four shortcut fields where it has five, `discard` among them.
- Updated dependencies [f7dc7c8]
- Updated dependencies [d28ff77]
- Updated dependencies [9e2e425]
- Updated dependencies [5067c7a]
- Updated dependencies [561550a]
  - @weasel-js/react@1.17.0
  - @weasel-js/clock@1.17.0

## 1.16.2

### Patch Changes

- @weasel-js/clock@1.16.2
  - @weasel-js/react@1.16.2

## 1.16.1

### Patch Changes

- @weasel-js/clock@1.16.1
  - @weasel-js/react@1.16.1

## 1.16.0

### Patch Changes

- @weasel-js/clock@1.16.0
  - @weasel-js/react@1.16.0

## 1.15.2

### Patch Changes

- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
  - @weasel-js/react@1.15.2
  - @weasel-js/clock@1.15.2

## 1.15.1

### Patch Changes

- Updated dependencies [2992b55]
  - @weasel-js/clock@1.15.1
  - @weasel-js/react@1.15.1

## 1.15.0

### Patch Changes

- @weasel-js/clock@1.15.0
  - @weasel-js/react@1.15.0

## 1.14.2

### Patch Changes

- @weasel-js/clock@1.14.2
  - @weasel-js/react@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/clock@1.14.1
  - @weasel-js/react@1.14.1

## 1.14.0

### Patch Changes

- cc0e73a: `useSimulation` takes an optional `clock`, a `ClockHandle` from `@weasel-js/clock`. Given one, the simulation runs no frame loop of its own: it steps once per `step` ms of the clock's time (the clock's own `step`, or 1000/60), so the clock's pause, rate and visibility gating govern it, and the host's `useClockLoop` syncs it. A run is built up by stepping and cannot be unwound, so the clock should be declared `seekable: false`; time it goes back, as on a `reset`, steps nothing and leaves the nodes where they are. Time spent stopped or settled owes no steps once `restart` resumes it. `createSimulation` is unchanged, and without a clock nothing changes. This adds API.
- Updated dependencies [9912c13]
- Updated dependencies [3d36f5e]
- Updated dependencies [34a364e]
- Updated dependencies [4f68c3a]
  - @weasel-js/clock@1.14.0
  - @weasel-js/react@1.14.0

## 1.13.0

### Patch Changes

- @weasel-js/react@1.13.0

## 1.13.0-rc.0

### Patch Changes

- @weasel-js/react@1.13.0-rc.0

## 1.12.0

### Patch Changes

- Updated dependencies [91a1d84]
  - @weasel-js/react@1.12.0

## 1.11.1

### Patch Changes

- Updated dependencies [e30f4df]
  - @weasel-js/react@1.11.1

## 1.11.0

### Patch Changes

- Updated dependencies [63b310c]
- Updated dependencies [c6a0a52]
- Updated dependencies [ad0b069]
- Updated dependencies [d32cb70]
- Updated dependencies [398d71e]
  - @weasel-js/react@1.11.0

## 1.10.1

### Patch Changes

- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- Updated dependencies [b8bfb2d]
- Updated dependencies [35c4879]
- Updated dependencies [886380f]
- Updated dependencies [10c5d41]
  - @weasel-js/react@1.10.1

## 1.10.0

### Patch Changes

- efc5cea: simulation: a new package holding the N-body integrator that lived in core. `createSimulation`, its types, and the `DEFAULT_ALPHA_DECAY`, `DEFAULT_ALPHA_MIN`, and `DEFAULT_VELOCITY_DECAY` constants are the root entry, which needs no React and no DOM. `useSimulation` is in `@weasel-js/simulation/react`. `@weasel-js/core` and `@weasel-js/core/math` still export what they did.
- Updated dependencies [3bacb3e]
- Updated dependencies [1d34f51]
- Updated dependencies [80b29f6]
  - @weasel-js/react@1.10.0
