# weaselforge: stories in the workshop document

**Status: phases 1 and 2 built 2026-09-25.** Phase 3, deleting the frame side,
runs only if `check:forge-isolate` ever reports zero; it may never.

For whoever implements the change in `@weasel-js/forge`. Assumes you know forge's
shape as `2026-09-13-forge-design.md` describes it: a story renders in an
iframe ("frame"), a channel joins the frame to a labkit trial, and the trial holds
config and state.

**What this answers:** how the workshop renders a story as a React subtree in its
own document instead of in a frame, what the iframe is kept for while that lands,
and what makes it go away.

## Disposition

The iframe stops being the substrate and becomes a fallback.

- **Every story renders in-document by default.** A story becomes a labkit
  instrument directly: its `f.schema` is the trial's schema, its `render` runs in
  the workshop's realm, its state is the trial's state.
- **`isolate` is the only way into a frame.** A story or meta sets
  `isolate: '<why>'`, a string so the reason travels with the flag. Such a story
  keeps today's path unchanged: frame document, channel, serialized schema,
  provisional instrument.
- **The frame path is frozen.** It gets no new feature. Anything built after this
  lands in-document only, so an isolated story visibly lacks it.
- **A ratchet holds the count.** `check:forge-isolate` counts isolated stories
  and fails when the count is above the number it holds. Lowering the number is
  an ordinary commit; raising it is an edit to the script, seen in review, and
  a new story can do it when it has a reason.
- **Isolation is allowed, not ideal.** A story that does not fit stays
  isolated for as long as it takes, possibly indefinitely, and nobody is blocked
  by that. The bias is toward a rewrite when the story is next looked at, not a
  mandate to rewrite it. `viewport` on its own is not a reason: a `viewport`
  story is a stage box from day one.
- **The frame side is deleted if the count reaches zero.** That is a condition,
  not a milestone. While any story is isolated the frame path stays, frozen.

## What the frame does today, and what replaces it

| Frame provides | In-document replacement |
|---|---|
| CSS and JS realm isolation | none; a story's CSS and module state are page-global. A story that needs isolation sets `isolate` |
| Its own layout viewport (`vw`, `vh`, media queries, `position: fixed`) | a host with `contain: layout paint`, which is the containing block for fixed descendants; `vw`, `vh` and media queries read the workshop page |
| `viewport: {w, h}` | labkit's `stage` capability with `size` set: a fixed-size box the trial pans and zooms |
| Fault containment | `StoryHost`'s error boundary for render throws; an import rejection faults the trial; a runaway loop hangs the page |
| Hot reload inside the frame | vite propagates a story edit to the shell; phase 2 accepts it there, phase 1 takes the full reload and labkit restores the lab from `storageKey` |
| Schema functions cannot cross | they no longer have to: `showIf`, `validate` and custom control renderers run where they are declared |
| Warm frame pool, hello handshake, timeouts, protocol version | nothing |

## Story → instrument

`storyInstrument` takes a `LoadedStory` instead of a `ready` message and builds the
instrument from it directly:

- `config`: `withGlobals(story.config, globals)`, the story's own schema with the
  reserved `$globals` group added as today.
- `initialState`: the story's `state(config)` where it has one, else `null`.
- `render`: `<StoryTrial story ctx />` (below).
- `annotations`: one target, the host element, sized from its own box, with
  `base` calling `captureElement(host)` directly.
- `stage`: `{ size: story.viewport }` when the story names one.

**Loading.** The registry still builds a provisional instrument per index entry,
empty schema, so a trial can open before its module loads. Opening a trial
imports the entry's file through the importers map, runs `loadStories`, awaits
`prepare`, and replaces the instrument through labkit's mutable instrument list
(the first of the two labkit gaps the original spec added). `isReady` now means
the module has loaded. The `ready`/`readyKey` comparison goes; an instrument is
replaced when its `LoadedStory` identity changes, which is on load and on HMR.

**Index pages** become instruments the same way: `IndexPage` already renders many
stories in one document. Its `open` calls `lab.swapTrial` directly.

## The story host

`StoryTrial` is a shell component rendered by the instrument. It owns one element
per trial, `div.fg-story[data-fg-host="<trial id>"][data-fg-layout="<layout>"]`,
and inside it the same `StoryHost` boundary and `Decorated` chain the frame runs
today, with the setup's decorators outermost.

- **Globals.** Effective globals come from `StoryGlobalsContext` plus the trial's
  pins, as today. The host calls `applyGlobals` in a layout effect whenever they
  change. The signature becomes
  `applyGlobals(globals, { root, scope, style })`: `root` is the host, `scope` is
  a selector matching only that host, and `style(css)` writes `css` into a
  `<style>` forge owns for that host, so a setup that writes a font rule writes
  it under `scope` rather than on `document.head` for everyone. The app's
  `followScheme` keeps one `last` per root, not one overall, or the last host
  applied is the only one that follows an OS scheme change.
- **Overlays.** The host is wrapped in `OverlayPortalProvider container={host}`.
  `@weasel-js/ui` overlays already portal to the nearest `[data-wzl-theme]`
  ancestor, which `applyTheme` stamps on the host, so this is belt and braces.
  `Callout` portals to `document.body` by name and is a known escape.
- **Containment.** `.fg-story { contain: layout paint; }` so `position: fixed`
  descendants position against the host. `frame.css`'s `html, body` rule moves
  to `.fg-story`; the `.fg-frame--centered|padded|fullscreen` rules move to
  `[data-fg-layout]` on the host.
- **Out of view.** The `IntersectionObserver` unmount stays, applied to the host's
  children: a trial half a viewport away unmounts its story and remounts on
  return. Config and state are in the trial, so nothing is lost that the frame
  reload did not already lose. This is what bounds WebGL contexts.
- **First paint.** The host is hidden until the story's first commit and
  `document.fonts.ready`, then fades in, as the frame did on `rendered`.
- **`setConfig` and `setState`** call the trial's directly. The `$globals` path
  guard stays.

## Panels and trial chrome

`trialFrames` goes. Each thing it carried has a direct form:

| Was | Becomes |
|---|---|
| `send` + `vars.set` | `overrides.set(name, value)` on the host's `Overrides` |
| `vars` report | `scanCssVars` run against the host after a `MutationObserver` on the host settles; values resolve on the host, not `documentElement` |
| `audit` round trip | `runAxe(host)` with page-level rules disabled: `document-title`, `html-has-lang`, `html-lang-valid`, `landmark-one-main`, `page-has-heading-one`, `region`, `bypass` |
| `capture` round trip | `captureElement(host)`; the host carries the theme attributes, so mode rules apply in the clone |
| `size` | the host's own box |

While the frame path exists, the host registers into the same `trialFrames`
store the frame path uses, with direct implementations behind the same calls,
so the panels read one shape for both. The store is renamed when the frame
side goes. `createOverrides` takes the
host's `scope` and prefixes the setup's `cssVarsScope` with it; its keep-last
observer already tolerates several instances.

## CSF

`useArgs` and the local-args split stay in substance. The port is gone, but the
trial's config is persisted through structured clone, so a function, a React
element or a class instance still cannot be config. `isPortSafe` is renamed to
`isStorable` and the comments say storage, not port.

## Isolated stories

- `isolate?: string` on `StorySpec` and `MetaSpec`; `parameters.forge.isolate`
  in CSF. The value is the reason.
- `indexFile` reads it statically, the way it reads titles and descriptions,
  and puts `isolate` on the `IndexEntry`. A non-literal value is an index error.
  It has to be static because the point of isolation is that the shell never
  imports the module; an import is where a global stylesheet bleeds.
- An isolated entry builds today's instrument: `FrameView`, provisional schema,
  `onReady`. Nothing on that path changes.
- The shell now imports the frame config too, for decorators, `applyGlobals`,
  `cssVarsScope`, `parameters` and `prepare`. The two config modules stay two
  until the frame side is deleted, then fold into one.

**`check:forge-isolate`** (`scripts/check-forge-isolate.mjs`, in `check:*`, CI
and `prepublishOnly`): indexes the app's story globs with `indexFile`, lists
every isolated story with its reason, and fails when the count exceeds the
number the script holds. The number starts at whatever the phase 1 pass over all
stories leaves isolated.

## Story tests

`runStory` mounts `StoryTrial` in the test page with the story's defaults, no
state and no globals, waits for the first commit and a settle, then calls
`play({ canvasElement: host, config, globals })` and throws on a boundary error
or a play rejection, with the same `load`/`mount`/`render`/`play` phase prefixes.
No channel. `forgeTest` and `@weasel-js/forge/play` are unchanged.

## Testing

- **Unit, jsdom, `forge` project, in CI.** The host applies globals to itself and
  writes the font rule under its scope; overlays portal into the host; the
  instrument is built from a `LoadedStory` and replaced on load; overrides are
  per host; the axe exclusion list is passed; `indexFile` reads `isolate` and
  rejects a non-literal; `runStory` in-document; the ratchet script's counting.
- **What jsdom cannot see.** Containment, `contain: layout paint` against a real
  `Dialog`, the stage box, and the fade-in are browser checks: screenshot the
  dev app with a Dialog story, a Toast story and Prefs open beside a plain
  Button, and check that nothing escapes its tile.
- **Stories, browser, local.** `test:stories:forge` over the rewritten
  `runStory`; the pass over all stories that sets the ratchet's first number is
  this run plus a look at each layout-sensitive story in the dev app. Known
  candidates: `LabFit.stories`, whose play asserts the real viewport size;
  `CanvasStack.stories` and `Interstellar.stories`, which use `100vh`.
- **e2e.** `apps/forge/e2e/smoke.mjs` and `csf.mjs` stop looking for an iframe.

## What goes if the count reaches zero

`FrameView`, `framePool`, `trialFrames`, `answers`, `readyKey`, `labHarness`,
`mountFrame`, `protocol/*`, the frame entry, `frame.html`, `html.ts`, the frame
page in `build.ts`, the `./frame` and `./frame.css` exports, `defineFrameConfig`
(folded into one config), the ratchet script, and the three `docs/TODO.md`
entries about frame reloads. Roughly 1300 source lines and 950 test lines, by
today's count.

## Phases

Each ends with something runnable.

1. **In-document by default.** `StoryTrial`, direct instruments, shell module
   loading, per-host globals, overrides, a11y and capture, `viewport` as a
   stage, static `isolate` keeping `FrameView` for the stories that need it,
   `runStory` rewritten, the ratchet script with its first number. `docs/TODO.md`
   marks the frame-reload entries as frozen with the frame path. Story edits
   reload the page.
2. **HMR of story modules in the shell.** Verify first, on a real edit, whether
   an `import.meta.hot.accept()` in the importers virtual module re-imports the
   changed file with a fresh timestamp; if not, the plugin's watcher already
   sends `forge:index` and gains a `forge:story {file}` event the shell answers
   by re-importing. Either way the registry rebuilds the affected instruments
   and open trials keep their config and state.
3. **Delete the frame side**, only if the count reaches zero. This phase may
   never run.
