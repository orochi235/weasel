# @weasel-js/labkit

React components for building **labs**: pages where you change parameters and
watch something redraw. A lab hosts one or more **instruments** — self-contained
experiments that own their settings and their state and render a picture from
both. Each open instrument gets a **trial**, one tile of the lab's workspace,
and the trial supplies the apparatus around it: a control panel, a toolbar, a
sidebar, undo, snapshots, persistence and drawing tools.

Reach for it when you have a visualization, a simulation or a rendering
algorithm and would rather not build the page around it.

## Install

```bash
npm i @weasel-js/labkit
```

React 19 is a peer dependency (`react` and `react-dom`, `^19.0.0`). One
stylesheet import covers everything labkit draws, including the theme tokens and
the `@weasel-js/ui` components it passes through:

```ts
import '@weasel-js/labkit/styles.css';
```

Annotations are on the `pre` tag until the next stable release:
`npm i @weasel-js/labkit@pre`.

## A lab

```tsx
import { type ConfigOf, defineInstrument, f, Lab, localStorageAdapter } from '@weasel-js/labkit';
import '@weasel-js/labkit/styles.css';

const config = f.schema({
  bins: f.number(20).range(5, 100).step(1).label('Bins'),
  showAxes: f.boolean(true),
});

const Histogram = defineInstrument<{ samples: number[] }, ConfigOf<typeof config>>({
  name: 'Histogram',
  config,
  initialState: () => ({ samples: sample(500) }),
  render: () => null,
  canvas: {
    layers: [
      { id: 'axes', draw: drawAxes },
      { id: 'bars', draw: drawBars },
    ],
  },
  layers: { ids: ['axes', 'bars'] },
});

export function App() {
  return (
    <Lab
      instruments={[Histogram]}
      defaultInstrument="Histogram"
      title="Histogram"
      storage={localStorageAdapter}
      storageKey="histogram-lab"
    />
  );
}
```

`f.schema` states the config once — values, types and controls — and the trial
renders the settings panel from it. `render` returns the instrument's own DOM;
returning `null` alongside `canvas` means the canvas layers are the whole
picture. `storage` keeps open trials and their state across reloads.

## Capabilities

A capability is a field on the instrument. Declaring it is what makes the trial
provide the corresponding chrome; they compose freely.

| Field | What the trial then provides |
| --- | --- |
| `canvas` | A stack of layered `<canvas>` elements with pan and zoom, redrawing only the layers that changed |
| `layers` | A sidebar list that hides and reorders those layers |
| `annotations` | Drawing tools, an overlay on each region you name, a Marks panel, undo and export |
| `loupe` | A magnifier toggle that redraws the canvas through a zoomed camera, or calls your own `render` for DOM content |
| `dragDrop` | A palette to drag items from, and a drop pipeline that hands you world coordinates |
| `undo` | Undo and redo buttons, snapshotting state on the events you name |
| `job` | Starts async work, aborts it on unmount and on a key change, and renders progress and a cancel control |
| `tools` | A tool palette and a tool slot on the trial |
| `chrome` | Anything else, as contributions keyed to a region |

## Annotations

An instrument names regions of itself that accept **marks** — freehand strokes,
lines, arrows, rectangles, ellipses and text drawn over its picture. labkit
supplies the tool palette, the overlay, the store, undo, persistence and export.

```tsx
const paneRef = createRef<HTMLDivElement>();

defineInstrument<State, Config>({
  // …
  annotations: {
    targets: () => [
      { id: 'pane', ref: paneRef, content: { w: 260, h: 180 }, positionDependsOn: ['angle'] },
    ],
    meaning: {
      statuses: [
        { id: 'open', label: 'Open', color: '#e5484d' },
        { id: 'fixed', label: 'Fixed', color: '#30a46c' },
      ],
    },
  },
});
```

A mark's position is stored as fractions of its target's `content` box, so it
stays on the same feature when the picture is rendered at a different size.
`positionDependsOn` names the config keys that move the picture; labkit
snapshots their values beside each mark, and a mark whose values have since
changed draws dashed and reports `isStale`. `meaning.statuses` is the optional
vocabulary a mark can be labelled with — a status carries its own color, which
the mark on the canvas follows.

Marks live in the trial's record and survive a reload. An instrument that would
rather keep them in a format it already owns declares `annotations.storage` with
a `load`/`save` pair, and labkit never writes its own slot.

`useAnnotations()` reaches the store from the instrument's `render` or from a
chrome contribution, and re-renders its caller as marks change:

```tsx
const marks = useAnnotations();
const stale = marks.query({ target: 'pane' }).filter((m) => marks.isStale(m, config));
```

`selection()` answers which marks the user has picked on the overlay, as
annotation ids, and `setSelection()` replaces them — the same selection
weasel's own click, marquee and handles drive, merged across every target.
A panel that opens a card for the clicked mark subscribes and re-reads it.

It also carries `get`, `hitTest`, `within`, `add`, `update`, `setMeta`,
`remove`, `undo`/`redo` and `capture`.

**Export.** A target declaring `base()` hands over the picture underneath its
marks — SVG markup, an image `src` or a canvas — and
`capture(target, { format, scale })` returns a Blob with the marks drawn on top,
as PNG or, from an SVG base, as vector SVG. Declaring `annotations` earns an
Export button in the toolbar; `onCapture` fires after every export, labkit's own
chrome included.

The pieces are exported for a host that wants to assemble them itself:
`createAnnotationStore`, `<AnnotationOverlay>`, `<AnnotationTargets>`,
`<MarkList>`, `<ExportMenu>`, `ANNOTATION_TOOLS` and `capturePlan`.

## Chrome

A trial's chrome has six named regions — `titlebar`, `toolbar`, `palette`,
`sidebar`, `viewport`, `status`. A `TrialContribution` names one and supplies
data the region lays out, or a `render` function that opts out of that layout:

```tsx
<Lab
  chrome={[{ id: 'seed', region: 'status', item: { text: `seed ${seed}` } }]}
  suppress={['fps']}
  // …
/>
```

Contributions passed to `<Lab>` apply to every trial; an instrument's own
`chrome` field applies to its trials only. `suppress` drops a built-in by id and
throws on an id that is not there.

A sidebar section can be torn out of the trial into the workspace — as a tile
beside the trials, or as a floating panel — with the trial still rendering into
it. `SidebarSection.undockable` and `undockAs` control the offer;
`undockPanel` / `dockPanel` move one.

## Theming

labkit ships one theme, `interstellar` — a cosmic dark and a warm parchment
light — as a value, not a stylesheet. `<Lab>` and `<LabShell>` apply it for you;
`mode` is `"auto"` (follow the OS), `"light"` or `"dark"`. Only `styles.css`
needs importing, and the token values arrive through the provider:

```tsx
import { interstellarTheme } from '@weasel-js/labkit';
import { ThemeProvider } from '@weasel-js/theme/react';

<ThemeProvider theme={interstellarTheme} mode="dark">…</ThemeProvider>
```

Style your own surfaces against the `--wzl-*` tokens so they follow the mode the
lab is in. Class names are `lk-*` and are not public API — every component takes
a `className`.

## Without the runtime

The presentational pieces work on their own. `<LabShell>` is a titled page
frame; `<Workspace>` is a tile grid that can be resized and reordered and takes
any children:

```tsx
import { LabShell, Workspace } from '@weasel-js/labkit';

<LabShell title="My Lab" header={<button>+ Add</button>}>
  <Workspace ids={['a', 'b']} resizable>
    <MyPane id="a" />
    <MyPane id="b" />
  </Workspace>
</LabShell>;
```

`<Toolbar>`, `<Sidebar>`, `<StatusBar>`, `<FpsMeter>`, `<ScaleIndicator>`,
`<Legend>`, `<FloatingPanel>`, `<ZoomControl>` and the `@weasel-js/ui` property
rows re-exported from the root are all usable this way. `<Trial>` is not: it
reads the lab store and only mounts inside a `<Lab>`.

## Driving your own renderer

`CanvasStack` is 2D. For three.js or raw WebGL, take rects and dirtiness from
labkit and keep the GL yourself:

```tsx
import { toDeviceRect, useSurfaceTile, useTiledSurface } from '@weasel-js/labkit/surface';
```

A trial's `view` is opaque to labkit — persisted, restored on Reset and handed
to the instrument without being read into — so a 3D lab stores an orbit there.
Both cameras ship independently of `CanvasStack`: `useOrbit` for a 3D view,
`usePanZoom` for a 2D one over a `ViewTransform`. See `src/surface/AGENTS.md`
for the contract and the traps.

## Subpath exports

The root barrel carries the common surface; a subpath reaches one slice
directly. Several expose more than the root does, `/state` most of all.

| Subpath | |
| --- | --- |
| `@weasel-js/labkit` | Everything |
| `/styles.css` | The one stylesheet |
| `/primitives` | Toolbar, Sidebar, StatusBar, Legend, FloatingPanel, meters |
| `/chrome` | Regions, contribution types, built-in contributions |
| `/controls` | `<ControlPanel>` and the config field types |
| `/canvas` | `<CanvasStack>`, coordinate helpers, `usePanZoom`, `useOrbit` |
| `/layers` | `<LayerList>` |
| `/loupe` | Magnifier components and `useLoupe` |
| `/surface` | Tiled surface hooks for your own renderer |
| `/job` | `useJob` and the job capability types |
| `/state` | The lab store, storage adapters, `useTrialState`, serialization helpers |
| `/undo` | Undo stack and event bus |
| `/dragdrop` | `<Palette>`, `<DragGhost>`, `useDragDrop` |
| `/ui/layers` | `<LayerStack>`, the expandable layer-card list |
| `/weasel-ui`, `/weasel-canvas` | Passthroughs to `@weasel-js/ui` and `@weasel-js/core` |

## Development

labkit is a workspace package in the [weasel](https://github.com/orochi235/weasel)
monorepo. From the repo root, `npm install` once, then from `packages/labkit`:

```bash
npm run dev            # Vite dev server on examples/minimal
npm run dev:annotate   # …on examples/annotate-lab (and dev:drag, dev:weasel, dev:schema)
npm test               # Vitest
npm run lint           # Biome, plus the class-prefix and design-token checks
npm run build          # dist/ for publish
npm run docs:dev       # VitePress on docs/ (docs:build to render it)
```

Storybook is built at the repo root: `npm run storybook` from there covers every
package.

## Documentation

- [Docs site](https://orochi235.github.io/weasel/labkit/)
- [Recipes](https://orochi235.github.io/weasel/labkit/RECIPES) — composition patterns
- [Agent guide](https://orochi235.github.io/weasel/labkit/AGENTS) — a map of the source
- [Storybook](https://orochi235.github.io/weasel/docs/ui/storybook/)
- [Design spec](https://github.com/orochi235/weasel/blob/main/packages/labkit/docs/superpowers/specs/2026-04-26-labkit-design.md)
