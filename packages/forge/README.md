# @weasel-js/forge

A component workshop built on labkit. It reads Storybook's story files and
renders each story in its own frame document; the story's controls, state,
undo and snapshots live in a labkit trial beside it, so two settings of one
component can be compared side by side.

Direction: `docs/superpowers/specs/2026-09-13-forge-design.md`.

## Config modules

The vite plugin takes two optional config modules, one per realm, because the
workshop page and each frame document are separate documents:

- `frameConfig` default-exports `defineFrameConfig({...})`: decorators around
  every story, `applyGlobals` for what a global does to the frame document,
  `cssVarsScope`, and `parameters`, the project-wide CSF parameters that
  Storybook keeps in `preview`. Only frame documents import it, so its CSS
  stays off the workshop page.
- `shellConfig` default-exports `defineShellConfig({...})`: lab chrome, control
  renderers, and global declarations. Only the workshop page imports it.

```ts
forge({ stories: ['src/**/*.stories.tsx'], frameConfig: 'forge.frame.tsx', shellConfig: 'forge.shell.tsx' });
```

## Story tests

`forgeTest` from `@weasel-js/forge/vite` runs every story as a vitest browser
test: each story renders through forge's frame with its defaults, plays, and
fails on any fault. Pass it the same `frameConfig`. It needs vitest 4 in browser mode with a provider, such as
`@vitest/browser-playwright`. This repo runs it with
`npm run test:stories:forge`, not in CI.
