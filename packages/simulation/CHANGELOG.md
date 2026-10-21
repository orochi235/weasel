# @weasel-js/simulation

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
