# Document modes

**Status: designed 2026-11-02, nothing built.** This doc is for whoever plans and builds it. It
answers: what base document modes the engine and the editor shell offer, and how a page becomes
an ordinary scene container.

## Intent

An editor built on weasel picks how its document is shaped, and the engine manages that shape
rather than every app rebuilding it:

| Mode | What the document is | Prior art |
|---|---|---|
| **Continuous** | No regions. An infinite plane in 2D, or infinite space in a kernel3d scene. | Figma's canvas, a whiteboard |
| **Pages** | An ordered run of fixed-size sheets, in a column or a row. | Word (column), a PDF scrolled sideways (row) |

**Pages are containers** (decided 2026-11-02). A page frames its children's poses the way every
other container does, so what is on a page is in the page's local coordinates, with its origin
at the page's top-left corner. Membership is the tree, not geometry.

## Goals

- Continuous and Pages as engine surface in core, with the editor shell (`@weasel-js/editor`)
  offering a choice between them.
- A page is a scene node that frames and clips its children, using the container machinery that
  already exists (taxonomy, "Pose" and "Mark / Group").
- The run of pages is laid out by a layout strategy on one document-level container, so
  reordering, resizing, adding, and removing pages are ordinary scene edits, each one undo entry,
  and a page's content goes with it for free.
- Pages run in a `column` or a `row` (decided 2026-11-02).
- Scrolling through pages is **continuous by default** (decided 2026-11-02): the view moves
  freely across pages, as a PDF viewer's "continuous" setting does. A `single` paging setting,
  where the view comes to rest fitted to one page, is an option.
- A **pasteboard** outside the pages, where objects can live in world space, is **opt-in**
  (decided 2026-11-02). Off by default.

## Non-goals

- **Positionable artboards** (Illustrator): pages placed freely, dragged, resized, and drawn with
  a tool. Maybe later (2026-11-02). The container model is chosen so that they would be a third
  layout policy on the same document container rather than a new model.
- Pages in 3D. A page is a flat sheet; a kernel3d host gets Continuous only. That is a stated
  choice, not an oversight.
- Converting a document from one mode to another.

## Anti-goals

- Two models of a page living side by side. The `core:pages` doc value and spatial membership
  are replaced, not kept as a second path.
- A mode that only the editor shell knows. The shell offers the choice; the engine owns the
  structure, so a consumer not using the shell gets the same modes.

## What exists now (2026-11-02)

- `packages/core/src/core/pages/`: pages as a scene doc value under `core:pages`
  (`PagesDoc { pages, layout }`). `layoutPages` places them in a row or column with a gap;
  membership is spatial (`pageMembers`: a root belongs to the page it overlaps most), and the
  page edits (`setPages`, `addPage`, `movePage`, `resizePage`, `removePage`) move each page's
  members by however far the page moved.
- `@weasel-js/editor`: `usePages` (current page, `goTo`, `step`, add/remove/move/rename/resize),
  `usePageFit`, `usePaperLayer` (paints the pages as a render layer), `usePageGrid`.
- Readers of `core:pages` that move to the new model: `apps/draw` (`Editor.tsx`,
  `pages/drawPages.ts`, `svgPages.ts`, `svgInterop.ts`, `saveSvg.ts`), `apps/chart`
  (`chartDocument.ts`, `pages/`), `packages/diagram/src/offPage/` (off-page connectors),
  `packages/diagram-formats` (`toScene.ts`, `fromScene.ts`, `pageKinds.ts`, templates).
  No consumer outside this repo reads it (collego checked 2026-11-02).
- Containers: a node frames its children's poses unless it is an envelope, may clip
  (`NodeClip`), may set units for its children (the measure tool reads a measurement in the units
  of the frame its ends land in), and may declare a `LayoutStrategy` (`packages/core/src/layout/types.ts`)
  that the layout pass runs, with `arrive`/`depart` for children joining and leaving.
- Bounding the view to content is a separate view setting (draw's "Bound view to content"). It
  is not part of any mode.

## The design

### The page

A page is a node in the scene. Its size is its pose (a rect, placed by the page run). What makes
it a page, its name, and the `meta` record `Page` carries today (`diagram:graph` lives there) are a
kit-owned node field, alongside `clip`, `layout` and `units`, never the consumer's `data`, which
the kit does not read. *(Builder's call, settled in review.)* It:

- frames its children (local coordinates, origin top-left);
- clips its children to its outline;
- paints the paper (the document's background color), replacing `usePaperLayer`;
- sets no units of its own by default. The document's units are the root scope, as now; a page
  that needs its own takes the node-level `units` field every container already has
  (`core/scene/unitScopes.ts`). *(Builder's call, settled in review.)*
- is not selected, moved, ungrouped, or deleted by the ordinary scene tools; page edits go
  through the page API. Pressing empty paper starts what pressing empty canvas starts today
  (a marquee, with the select tool).

### The page run

One document-level container holds the pages as its children and lays them out with a page-run
layout strategy in core: `direction: 'column' | 'row'`, `gap`, `align`, the options
`PageLayoutOptions` has today. The strategy lives in core because core cannot depend on guides,
where `sequenceLayout` is.

Mode is read from structure: a scene with a page run is in Pages mode; one without is Continuous.

### Nodes that follow other nodes

A node whose pose follows others (`dependsOn`; a diagram connector between two ends) is a child
of the page run, not of a page (decided 2026-11-02). It draws across pages, clipped by neither,
and moves with its ends wherever they go. Off-page markers (`packages/diagram/src/offPage/`)
stay an opt-in way to show a connector between pages, and read each end's page from its
page ancestor instead of from geometry.

### The pasteboard (opt-in)

A flag on the page run. On: roots outside every page are allowed and stay in world space; a drag
from a page onto the pasteboard reparents to the root, and back again. Off (the default):

- an object dragged off its page stays that page's child, its overhang clipped;
- a drop in the gap between pages leaves the object in the page it came from;
- a new object drawn or pasted outside every page goes into the nearest page, moved so it lies
  on it;
- a drag that would leave an object wholly off its page stops where part of it is still on the
  page. Nothing ends up clipped to nothing.

*(The last two are the builder's call, settled in review: an object that cannot be seen or
pressed is not a state the editor should have to show.)*

### Moving between pages

Dragging an object onto another page reparents it into that page, through the move action's
existing container `depart` / `arrive` path. Its world position is kept, so its local pose changes.

### Paging

`paging: 'continuous' | 'single'`, default `'continuous'`. A view setting, not a document
property: the same file opens in either. `single` means the view comes to rest fitted to one
page; the next and previous page are a step away. Nothing in core snaps the camera to a page
today, so `single` is new behavior in the viewport actions.

### The editor shell

`EditorShell` (or a hook beside it) takes the mode for a new document and, in Pages mode, the
page run's settings and the paging setting. `usePages` and `usePageFit` keep their roles and read
the page nodes instead of the doc value.

## Left to the builder

- Whether a page is a `mark` or a `group` node, and how "not selectable by ordinary tools" is
  expressed (`nodeGates`, `lockGuard`, `pickable`, or something new).
- What a document saved with `core:pages` loads as. In-repo saved data exists in draw's SVG
  files (`wd:` namespace) and chart's documents; a load-time conversion to page nodes is
  expected.
- How `single` paging reads input: whether a swipe flips exactly one page, or scrolls freely and
  settles on the nearest.
- How the arc splits into branches.
