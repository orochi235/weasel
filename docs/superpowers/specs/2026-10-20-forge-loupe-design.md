# Forge loupe

**Status: first version built (2026-10-21); Glass and the later readouts are unbuilt.** Glass has
its ops (`setAimOps`) but no action, so no user can aim a lens at it. For whoever extends
weaselforge's loupe. It answers what the loupe does, what it is built from, and what shipped first.
How the built version works: `packages/labkit/src/loupe/AGENTS.md` ("Lenses") and
`packages/forge/README.md` ("Loupe").

## What it is

A lens for proofing and comparing stories in weaselforge (`packages/forge`). You aim it at part of
a story and it shows that patch magnified, the same patch rendered under a different condition, or
both, with readouts over it. Forge has no loupe today, although the kit it is built on has one at
every layer: `@weasel-js/loupe` holds the model (aim, factor, mode, color sampling), and
`@weasel-js/labkit/loupe` binds it to a trial, with painters, actions and a toolbar switch
(`packages/labkit/src/loupe/AGENTS.md`).

Seeing the story in the opposite day/night mode was where this started (2026-10-20). It is one
comparison among many, not the feature.

## Goals

- **Proof what a story actually renders.** The real pixels at 1× and 2×, magnified
  nearest-neighbor, so a hairline half a pixel off or a soft glyph shows as it does on screen.
- **Compare the story against itself under any condition forge controls:** mode, theme,
  density, text direction, any arg, device pixel ratio.
- **Lenses are objects in the workshop.** You can park one, move it, resize it, aim it and leave
  it, and it keeps showing its spot while you work the story.
- **Every control is an action with a default key**, rebindable like any shortcut.

## Non-goals for the first version

- Comparing against another revision (`main`, the last commit) or a reference image (a baseline
  screenshot, a design export). They come later, but the design reserves their slot (see
  "Sources").
- The "glass" aim setting (below). Designed for, not built.
- The readouts after the first set (see "Readouts").

## Anti-goals

- **A re-render passed off as proofing.** A lens that redraws a story at 8× draws a half-pixel
  hairline as a crisp line. Proofing views must say which source they show, and the pixel source
  must be the real rasterization.
- **Loupe-specific drag, resize, select or undo code.** Lenses are scene nodes; the kit's tools
  and ops do this.
- **A lens that blocks the story.** Pointer input that misses a lens and its reticle reaches the
  component underneath.

## The lens as an object

A lens is two nodes in a weasel scene drawn by an overlay canvas above the workshop: the **body**
(the bubble you see) and the **reticle** (the spot it shows). They map onto labkit's existing split
between where a lens sits (`LoupeLens.center`) and what it shows (`LoupeLens.shows`). Moving,
resizing, selecting, deleting and undoing a lens are core's own tools and ops (2026-10-20).

The reticle has an aim setting, per lens, switchable by action:

| Setting | The reticle | First version |
|---|---|---|
| **Pinned** (default) | is a free node you drag; a leader line ties it to the body | yes |
| **Follow** | tracks the pointer, like a docked magnifier | yes |
| **Glass** | sits at the body's center, so the lens shows what it lies on | later |

Mike asked for Pinned as the default, Follow in the first version, and Glass later (2026-10-20). He also wants
switching Pinned to Glass to be a few kit calls: Glass is the reticle's pose derived from the body,
as an edge's path derives from the nodes it joins, so the switch is an op that sets or clears that
dependency. Build the reticle so this needs no new mechanism.

labkit's ordinary cursor loupe is Follow with the body following too, so it is the same mechanism.

**What a lens is attached to, and whether it persists, is the host app's choice** (Mike,
2026-10-20). The lens mechanism takes both as options rather than deciding them. Forge's choice: a
lens's body and pinned reticle stay put in viewport coordinates until dragged, so scrolling or
zooming a pane moves the story under a lens, not the lens. That puts one overlay scene over the
whole workshop, and lets a lens parked over one trial aim at another. Forge's lenses last for the
session and are not saved with a trial (my call, 2026-10-20).

## Sources

What a lens shows is a **source** rendering the story patch under the reticle. The first version
has two, chosen per lens by action, because each one suits a different situation (2026-10-20):

| Source | How | Use |
|---|---|---|
| **Live** | A second render of the story with its globals or args changed, at the lens's factor | Comparisons; anything interactive. Sharp at any zoom, never the real pixels. |
| **Pixels** | Forge's dev server renders the story in headless Chromium at a chosen DPR and returns the PNG; the lens enlarges it nearest-neighbor | Proofing. Real pixels at 1× and 2×, side by side if asked. Lags the live story by a capture; hover and focus are not in it. |

The same interface must later admit **Revision** and **Reference** sources. Those render outside
the page too, so the Pixels source's capture path is the one they will extend. Design the source
contract for all four now.

### Live rendering, from the code

`StoryTrial` (`packages/forge/src/shell/StoryTrial.tsx`) renders a story through `TrialHost`.
`TrialHost` contains fixed-position descendants and portals in its own box, so a popover opened in
a lens's copy can stay in the lens and take its mode. But a second copy is not a second call of
anything that exists today, and three things have to change for one:

- **A copy needs its own conditions.** `render` is a closure inside `StoryTrial` over the trial's
  shared `config`, and `TrialHost` computes globals itself from `StoryGlobalsContext` and the
  `$globals` pins. A Live source needs a way to render the story with a config override (changed
  args) and globals passed in.
- **A copy needs its own host id.** `TrialHost` uses `trialId` as its host id, and
  `createGlobalsTarget` scopes its CSS to `[data-fg-host="<id>"]`, so a second host under the same
  trial would restyle the main story with the copy's globals.
- **A copy must stay out of the frame registry.** `frames.connect(trialId, …)` would replace the
  main host's entry, pointing the CSS vars panel and the a11y audit at the copy, and its disconnect
  on unmount would leave the main story disconnected.

Both copies read the lab's `config` and `state`, so args a comparison does not override, controls,
and the playhead stay in step. State inside the story's components (hover, focus, an open menu) is
not shared.

Stories marked `isolate` render in iframes from the frame pool (`framePool.ts`,
`FrameView.tsx`), not in the document. A Live lens on one needs a second frame with the changed
conditions.

### Pixel capture

Forge's vite plugin (`packages/forge/src/vite/plugin.ts`) gains a dev-server endpoint returning a
PNG of a story's box at a chosen DPR, rendered in headless Chromium. **A capture reproduces
everything the live story is rendered from**: args, globals, trial `state`, the playhead, and the
CSS variable overrides from the vars panel; one that left any out would proof a different story
(my call, 2026-10-20). Forge's URL (`route/url.ts`) carries args but keeps `$`-prefixed config,
`$globals` included, out of it, so the endpoint takes its own payload rather than a URL.

Forge is published and Playwright is only a root dev dependency, so Playwright becomes an optional
peer dependency of `@weasel-js/forge`; without it the Pixels source reports itself unavailable and
the lens offers Live only (my call, 2026-10-20).

## Comparisons

A comparison is a source with one or more conditions changed: mode, theme, density, direction,
an arg, DPR. The lens shows it one of these ways, chosen by action:

| View | What you see |
|---|---|
| **Swap** | Only the compared render |
| **Split** | The two halves of the lens, with a seam you drag |
| **Difference** | Only the pixels that differ, lit; the rest dimmed |

A DOM render has no pixels to read, so **Difference compares two Pixels captures**, one per side,
even when the lens is showing Live (my call, 2026-10-20). Swap and Split work on either source.

"Opposite mode" is a one-key preset: mode flipped, everything else unchanged.

## Readouts

Toggles in the lens chrome, each one an action with a key. First version (2026-10-20):

| Readout | Shows | Builds on |
|---|---|---|
| **Token** | The color at the aim and the `--wzl-*` token chain behind it; clicking opens the CSS vars panel at that token | New: the element under the aim, its computed color, and the declarations and `var()` chain that produced it. `frame/cssVarUse.ts` only lists which variables a story's sheets read. |
| **Contrast** | The WCAG ratio of the text under the aim against its effective background, with AA/AAA pass/fail | Computed styles of the element under the aim and its backgrounds on a Live source; sampled pixels on a Pixels one |
| **Pixel grid** | The grid at 8× and up, with edges landing between pixels tinted | The Pixels source |
| **Difference** | As in "Comparisons" | Any two sources |

Later: a box overlay (margin, border, padding, content, distances to neighbors), baseline and
density-grid guides, an element breadcrumb that jumps to the story or source, and freeze (hold the
lens's image while args change).

## Keys

Every control is a labkit action. Forge has no list of its key bindings today, so this work adds one: a panel listing every binding forge registers, the loupe's included (my call, 2026-10-20).

The loupe's actions live in one **Loupe keymap** (`keymapContribution`, `docs/taxonomy.md` "Keymap and leader"), opened by the leader Alt+L, matched by physical key. Inside it the keys are plain (`l` adds a lens, `Shift+L` closes it), so a story's own typing never reaches a lens action. Escape closes the keymap, `<KeymapHint>` lists it while open, and each binding has an id equal to its action id, so `bindingOverrides` can rebind it (2026-10-20).

While Follow is aiming, the pointer is busy. A held leader keeps the keymap open, so `Alt+L`-held then `p` pins the reticle while the pointer works the story.

## Left to the builder

- Default keys, chrome layout, how the aim and source settings are presented.
- How the overlay canvas is mounted over the workshop and how its hit-testing lets misses fall through.
- How the capture endpoint receives globals, caches captures, and keeps its cache bounded.
- Which package owns what. Since attachment and persistence are host options, the lens objects and
  the source contract are labkit surface that forge configures; capture, which needs forge's dev
  server and story registry, is forge's. Check that against `CLAUDE.md`'s "What gets its own package".
- How many lenses can be up at once.
- Whether lens moves share an undo history with forge's own (`shell/cssVars/varsHistory.ts`) or keep
  one of their own.
