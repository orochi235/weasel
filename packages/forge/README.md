# @weasel-js/forge

A component workshop built on labkit. It reads Storybook's story files and
renders each story in its own frame document; the story's controls, state,
undo and snapshots live in a labkit trial beside it, so two settings of one
component can be compared side by side.

Direction: `docs/superpowers/specs/2026-09-13-forge-design.md`.

## Story tests

`forgeTest` from `@weasel-js/forge/vite` runs every story as a vitest browser
test: each story renders through forge's frame with its defaults, plays, and
fails on any fault. It needs vitest 4 in browser mode with a provider, such as
`@vitest/browser-playwright`. This repo runs it with
`npm run test:stories:forge`, not in CI.
