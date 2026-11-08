# @weasel-js/simulation

## 1.17.4

### Patch Changes

- 7e83b0f: A wallpaper whose extent leaves its center out now draws its cell's copies about the original, as its guide and its edit symmetries already assumed. `useSimulation`'s docs say which options it reads only at mount, and the loupe model's docs spell color the US way.
- Updated dependencies [b4163e6]
- Updated dependencies [6cd51e2]
- Updated dependencies [e3ce292]
  - @weasel-js/react@1.17.4
  - @weasel-js/clock@1.17.4

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
