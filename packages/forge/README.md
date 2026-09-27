# @weasel-js/forge

A component workshop built on labkit. It reads Storybook's story files and
renders each story in the workshop page as a labkit trial: the story's
controls, state, undo and snapshots live in the trial, so two settings of one
component can be compared side by side.

Direction: `docs/superpowers/specs/2026-09-13-forge-design.md`.

## Where a story renders

A story renders inside a host element in the workshop document. The host
carries the theme attributes the globals resolve to, keeps its CSS variable
overrides on itself, contains its fixed-position descendants, and is where
weasel overlays portal, so a Dialog opened in one trial stays in that trial.
`vw`, `vh` and media queries read the workshop page, not the host; a story
with a `viewport` renders as a fixed-size box the trial pans and zooms.

A story that needs a document of its own says so, with the reason:

```tsx
export const Interactive = story({ isolate: 'ToastRegion portals to document.body', render: … });
// CSF: parameters: { forge: { isolate: 'ToastRegion portals to document.body' } }
```

It then renders in an iframe, as every story once did. The frame path is kept
for those stories and gets no new features; `npm run check:forge-isolate`
lists the isolated stories and fails when their number goes above the one the
script holds, so the count only goes down. The value is read from the source
without running it, and must be a string literal.

A story may stay isolated as long as it needs to. If the count ever reaches
zero, the frame side goes: `FrameView`, `framePool`, `trialFrames`,
`answers`, `readyKey`, `labHarness`, `mountFrame`, `protocol/*`, the frame
entry, `frame.html`, `html.ts`, the frame page in `build.ts`, the `./frame`
and `./frame.css` exports, the ratchet script, and the `docs/TODO.md` entries
about frame reloads; `defineFrameConfig` folds into one config.

## Config modules

The vite plugin takes two optional config modules:

- `frameConfig` default-exports `defineFrameConfig({...})`: decorators around
  every story, `applyGlobals` for what a global does to a story's host (or to
  a frame document's root, for an isolated story), `cssVarsScope`,
  `parameters`, the project-wide CSF parameters that Storybook keeps in
  `preview`, and `prepare`, awaited before a story first renders, which is
  where to import what only some stories need. `applyGlobals` is handed a
  target: its `root`, a `scope` selector matching only that root, and
  `style(css)` for a rule that should reach that story alone.
- `shellConfig` default-exports `defineShellConfig({...})`: lab chrome, control
  renderers, and global declarations. Only the workshop page imports it.

```ts
forge({ stories: ['src/**/*.stories.tsx'], frameConfig: 'forge.frame.tsx', shellConfig: 'forge.shell.tsx' });
```

Editing a story file reloads that story in every trial showing it, with the
trial's config and state kept; the page itself stays.

Clicking a story in the tree, or reaching one by its URL, shows it in the
focused trial; Shift-click opens another trial beside it.

## Index pages

Every component — every story title — has an index page, opened by clicking
the component's row in the sidebar (its fold mark only folds it) and routed at
`#/<title id>:index`. It renders all
of the component's stories in one trial: each at its defaults, then once per
value of each of its boolean and enum controls, one control at a time.

Under its title, an index page lists the components it uses and the ones that
use it, each linking to that component's index page. The plugin reads these
from source, not from anything an author writes: a component is the binding its
meta's `component` names, followed through imports and re-exports (barrels
included) to the file declaring it. When `component` is declared in the story
file itself, or absent, the import the title's last segment names stands in.
What it uses is every listed component that declaration reaches, through that
file's local helpers and the relative imports in its own directory. A component
whose file forge cannot find says so on its page and lists nothing. The graph is
built the first time the workshop asks for it, after the page is up, and an edit
re-reads only the file it touched.

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

A custom page gets the list as `Dependencies`, and `gallery` says whether the
component is one.

## Galleries

A story file that catalogs many components, or every permutation of one, tags
its meta `gallery`, CSF's own `tags` field; a single such story tags itself.
Tags must be string literals, since the index reads them without running the
file. A story's tags are its meta's plus its own, and `'!gallery'` on a story
drops the meta's.

```ts
const meta: Meta = { title: 'ui/Icons/Gallery', tags: ['gallery'] };
export const AllPermutations: Story = { tags: ['gallery'], render: … };
```

A gallery row carries a grid mark in the sidebar and a Gallery badge on its
index page. A component every one of whose stories is a gallery is left out of
the dependency lists entirely, so a catalog that imports everything does not
appear as a user of everything.

## Story tests

`forgeTest` from `@weasel-js/forge/vite` runs every story as a vitest browser
test: each story renders in the test page through the same host the workshop
uses, with its defaults, plays, and fails on any fault. Pass it the same `frameConfig`. It needs vitest 4 in browser mode with a provider, such as
`@vitest/browser-playwright`. This repo runs it with
`npm run test:stories:forge`, not in CI.
