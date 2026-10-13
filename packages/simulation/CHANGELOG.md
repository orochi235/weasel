# @weasel-js/simulation

## 1.10.0

### Patch Changes

- efc5cea: simulation: a new package holding the N-body integrator that lived in core. `createSimulation`, its types, and the `DEFAULT_ALPHA_DECAY`, `DEFAULT_ALPHA_MIN`, and `DEFAULT_VELOCITY_DECAY` constants are the root entry, which needs no React and no DOM. `useSimulation` is in `@weasel-js/simulation/react`. `@weasel-js/core` and `@weasel-js/core/math` still export what they did.
- Updated dependencies [3bacb3e]
- Updated dependencies [1d34f51]
- Updated dependencies [80b29f6]
  - @weasel-js/react@1.10.0
