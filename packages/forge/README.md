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
  `cssVarsScope`, `parameters`, the project-wide CSF parameters that
  Storybook keeps in `preview`, and `prepare`, awaited before a story first
  renders, which is where to import what only some stories need. Only frame
  documents import it, so its CSS stays off the workshop page.
- `shellConfig` default-exports `defineShellConfig({...})`: lab chrome, control
  renderers, and global declarations. Only the workshop page imports it.

```ts
forge({ stories: ['src/**/*.stories.tsx'], frameConfig: 'forge.frame.tsx', shellConfig: 'forge.shell.tsx' });
```

## Index pages

Every component — every story title — has an index page, listed first under
the component in the sidebar and routed at `#/<title id>:index`. It renders all
of the component's stories in one frame: each at its defaults, then once per
value of each of its boolean and enum controls, one control at a time.

A component can supply its own page. A native meta takes `index`; a CSF meta
sets `parameters.forge.index`. Either is handed an `IndexContext` holding the
stories and the generated page's parts, `Story`, `Variants` and `DefaultIndex`,
so a custom page composes them:

```tsx
export default meta({
  title: 'ui/Button',
  index: ({ stories, Story, DefaultIndex }) => (
    <>
      <Story story={stories[0]} config={{ label: 'Save' }} label="In a form" />
      <DefaultIndex />
    </>
  ),
});
```

## Story tests

`forgeTest` from `@weasel-js/forge/vite` runs every story as a vitest browser
test: each story renders through forge's frame with its defaults, plays, and
fails on any fault. Pass it the same `frameConfig`. It needs vitest 4 in browser mode with a provider, such as
`@vitest/browser-playwright`. This repo runs it with
`npm run test:stories:forge`, not in CI.
