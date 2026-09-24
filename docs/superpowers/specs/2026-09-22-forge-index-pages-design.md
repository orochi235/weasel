# forge: faster frames, then component index pages

**Status: built 2026-09-22 on `forge-index-pages`.**

For whoever works on forge's shell or frame. It answers two questions: how a
story reaches the screen quickly, and what a component's index page is.

## Measured starting point

Opening a story in a trial, measured headless against a Button story from
clicking it to the story's first render:

| build        | per story | frame document's DOM ready | modules requested |
|--------------|----------:|---------------------------:|------------------:|
| dev server   |   1.70 s  |                     0.85 s |             > 250 |
| production   |   0.30 s  |                     0.09 s |                70 |

Script evaluation is 0.10–0.15 s of that in both. The rest is the dev server's
module waterfall, re-fetched by every new frame document, and two serial waits:
the shell hands over the port only on the iframe's `load` event (which waits for
every stylesheet and font), and the frame starts importing its story only after
the port arrives.

Every sidebar click creates a new document because `swapTrial` gives the trial a
new id, and labkit remounts `<Trial key={id}>` with its iframe.

## Stage 1: faster frames

After stage 1, a warm frame costs 75 requests on the dev server before the
story's own (9 for Button), and the production build opens a story in a median
262 ms against 409 ms before.

**The frame says hello.** The frame entry posts `weaselforge:hello` to its
parent as soon as it runs, and the shell hands over the port on that. Never on
`load`: the browser fires `load` first, and a port handed over then is the one
the frame keeps. The handoff message carries the id to show, a story or an
index, instead of the URL. When the URL does carry one (`frame.html#<id>`), the
frame starts importing it at once, in parallel with the handshake.

**A pool of warm frames.** The workshop keeps two frame documents loaded, blank
and off-screen. A `FrameView` claims one, moves it into its host with
`Element.prototype.moveBefore` (which moves an iframe without reloading it) and
hands it the port. A frame that has shown something is discarded when its view
unmounts — never returned to the pool — so no story's global CSS or leftover
state reaches the next one. The pool refills when idle. Where `moveBefore` is
absent, or no warm frame is ready, the view creates a fresh iframe as before.

**Only what the story needs.** `forge.frame.tsx` wraps `labkit/` stories in
`LabRoot`; it now imports labkit in the new `FrameSetup.prepare` hook, awaited
before a story first renders, and only for labkit stories. `labkit/config` no
longer imports `@weasel-js/ui` at runtime, which had pulled ui's 167-module
barrel into every frame.

## Stage 2: index pages

Every component — every story title — has an index page: one frame that shows
all of the component's stories and their variants, inline, in one document.

**Identity.** An index's id is `<sanitized title>:index`. The colon cannot occur
in a story id, so no export name can collide with it. It routes like a story
(`#/ui-foundations-button:index`) and runs as a lab instrument with an empty
schema, so it gets trials, history and the frame pool for free.

**Sidebar.** Every component row in both views is a folder holding its
stories. Clicking the row opens the folder and the component's index page;
its chevron only folds it.

**The generated page.** A header with the title and the file's meta
description, then one section per story, in file order:

- the story's name, its description, and an **Open** button that swaps the
  index's trial to that story;
- the story rendered at its defaults, interactive, inside its own error
  boundary, wrapped by its own and the frame config's decorators;
- **variants**: for each `boolean` or `enum` leaf of the story's config, a row
  of the story rendered once per value, every other leaf at its default. One
  control varies at a time, never the cross product. Enums over 8 options,
  custom controls and leaves hidden at the defaults are skipped; at most 6
  rows per story. Only the first story with a given set of rows shows them:
  stories of one CSF file share their meta's controls, and Button's eleven
  stories otherwise repeated the same six rows eleven times.

A story's `layout` holds per cell: `fullscreen` gets a fixed-height box.
`play` does not run on an index. Cells mount only while near the viewport, so
a page of canvas stories stays under the browser's WebGL context cap.

**A component's own page.** A native meta takes `index`; a CSF file sets
`parameters.forge.index`. Either is a render function given an `IndexContext`:
the title, description and loaded stories, plus the parts the generated page is
built from — `Story` (one story at given config), `Variants` (one story's
variant rows) and `DefaultIndex` (the whole generated page) — so a custom page
composes them rather than reimplementing them.
