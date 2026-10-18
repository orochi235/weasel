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
npm i @weasel-js/labkit @weasel-js/core
```

`@weasel-js/core` is a peer dependency, pinned to the matching version. labkit
does not ship its own copy: core keeps its content handlers, paint kinds, shape
painters and markers in module-global registries, and two copies means anything
registered through one is invisible to the other — a blank canvas with no error.

React 19 is a peer dependency too (`react` and `react-dom`, `^19.0.0`). One
stylesheet import covers everything labkit draws, including the theme tokens and
the `@weasel-js/ui` components it passes through:

```ts
import '@weasel-js/labkit/styles.css';
```

Its glyphs come from the app's icon registry, which labkit does not mount: with
none, every button in the lab draws a placeholder and warns. Mount one at the
root — the whole kit's tables, or the trimmed set `virtual:weasel-icons` builds
(`docs/icons.md` in the weasel repo):

```tsx
import { IconRegistryProvider } from '@weasel-js/core';
import { kitIcons } from '@weasel-js/ui/kit-icons';

<IconRegistryProvider icons={kitIcons}>
  <App />
</IconRegistryProvider>
```

## A lab

```tsx
import { type ConfigOf, defineInstrument, f, Lab } from '@weasel-js/labkit';
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
      storageKey="histogram-lab"
    />
  );
}
```

`storageKey` makes the lab persist: its trials, snapshots, layout and mode
survive a reload and stay in step across tabs. It persists to IndexedDB — or
localStorage, with a warning, where IndexedDB will not open — and `storage`
names another substrate: `localStorageAdapter`, `sessionStorageAdapter`,
`urlHashAdapter`, or your own `StorageAdapter` over a server. The lab renders
`fallback` while it loads. Leave `storageKey` off and nothing persists.

### Presenting a lab

`<Lab present>` shows one trial and nothing else — no lab chrome, no trial
chrome, a transparent ground — for embedding a lab as a figure. `?present` in
the page's URL does the same, so one build serves both the lab and its embed.
`seed={{ instrument, config, state, view }}` says what that trial opens on. A
stored lab presents from records of its own (`storageKey` + `':present'`), so
an embed never shows a visitor their last session in the full lab or writes
into it; changing the seed reopens the trial on it for returning visitors.

Inside any lab, `usePresentation()` gives `{ active, enter, exit }`: `enter`
presents the focused trial and Escape returns. Nothing unmounts either way, so
a canvas keeps its context and a clock its place. Entering refits a view the
instrument places by the viewport's size (`initialView` as a function, or a
fitted stage) to the presented box; leaving gives the tile its view back.

A presented trial whose instrument declares a `clock` gets play controls along
its bottom: play and pause, speed and loop, and — for a seekable clock with a
duration — a scrub bar and a reverse switch. Space plays and pauses, the arrows
step, Home and End jump, R reverses and `<` / `>` change speed. A run that ends
plays again after three seconds until a visitor touches the controls, and the
controls hide in a box narrower than 480px — `<Lab transport={{ minWidth: 760
}}>` moves that line. `<Lab transport={false}>` leaves them off;
`<TrialTransport>` is the same controls for any lab chrome.

A host page with a play control of its own reaches the lab by `postMessage`,
in a frame or in the page itself. A presented lab answers these, and posts its
state to the window around it as it starts, on every change, and when asked —
never per frame:

```ts
const lab = iframe.contentWindow; // `window` for a <Lab present> in this page
lab.postMessage({ type: 'labkit:play' }, origin); // an ended run starts over
lab.postMessage({ type: 'labkit:pause' }, origin);
lab.postMessage({ type: 'labkit:seek', time: 1200 }, origin); // ms into the pass
lab.postMessage({ type: 'labkit:query' }, origin); // ask for the state

window.addEventListener('message', ({ data }) => {
  if (data?.type !== 'labkit:state') return;
  // { clock, playing, ended, time, duration, rate, seekable }
  button.textContent = data.playing ? 'Pause' : 'Play';
});
```

`<Lab transport={false}>` leaves the lab's own controls off for a page that
draws its own. `<Lab messages={{ name: 'hero' }}>` names a lab on a page with
several: a message carrying `lab: 'hero'` reaches only it, and its state says
`lab: 'hero'`. `messages={{ origins: [...] }}` says which origins it takes
messages from, and `messages={false}` turns the channel off. The types are
`PresentationCommand` and `PresentationState`.

`<Lab still>`, or `?still` in the URL, presents the lab held still for a
poster: every clock paused where it opens — `still={1200}` or `?still=1200`
holds them 1200 ms in — with no play controls and nothing read from or written
to storage, so it shows the `seed` in anyone's browser. The lab's root gains
`lk-lab--still-ready` once that frame has been drawn, which is what a capture
waits for:

```ts
await page.goto('https://example.com/lab.html?still=1200');
await page.locator('.lk-lab--still-ready').waitFor();
await page.locator('.lk-lab').screenshot({ path: 'poster.png', omitBackground: true });
```

A clock that is not seekable is run forward to the time before the still is
ready, `step` ms a frame, when its declaration names a `step`; without one it
stays where it opens. Whatever an instrument animates off the clock or loads on
its own is the instrument's to settle.

`gestures` on `<Lab>` decides what the trials' cameras take — `{ drag, wheel:
'plain' | 'mod' | false, pinch, tap, home }`, over each instrument's own
`canvas.gestures` / `stage.gestures` / `orbit.gestures` — and whatever they
leave reaches the page: `<Lab present gestures={{ drag: false, wheel: false }}>`
is an embed the page scrolls past, keeping only the pinch. The keys mean the
same on every camera: `drag` pans a 2D one and turns an orbit, and `home` — a
double click back to where it opened — is on by default only for an orbit.

A widget's own state persists the same way through `usePersistedState(name,
initial)`, which is `useState` whose value survives a reload — kept per trial
inside one, and plain `useState` wherever no `<Lab>` or `<Persistence>` is
above it.

`f.schema` states the config once — values, types and controls — and the trial
renders the settings panel from it. `render` returns the instrument's own DOM;
returning `null` alongside `canvas` means the canvas layers are the whole
picture.

A value is addressed by its path: `bins` above sits at `config.bins` and is
written as `setConfig('bins', 40)`. `f.group` nests one —
`paper: f.group({ width: f.number(210) })` puts the value at
`config.paper.width` and addresses it as `'paper.width'`, in `setConfig`, in a
control override, and anywhere else a path is taken. `.section('Advanced')`
only puts a heading over sibling rows and
leaves their paths alone.

A stored config missing something its schema has since gained — a whole nested
group included — is filled from the instrument's defaults as it loads, so
growing a schema never strands a saved trial or a snapshot.

### Auto

A field can be **auto**: nobody is pinning it, and the instrument decides what
it should be. Shift-click a row in the settings panel, or click the pin dot
beside its label, and the control draws ghosted at whatever the value resolved
to. Shift-click again — or just grab the control — and it pins back at the
value it was holding all along.

`auto` is a value, so it goes wherever a config value goes:

```ts
import { auto, f } from '@weasel-js/labkit';

const config = f.schema({
  width: f.number(432),
  gap: f.number(12).auto((c) => (c.width as number) / 24),
  cols: f.number(3).initial(auto),
  seed: f.number(1),
  scale: f.number(1).auto(),
});

setConfig('gap', auto);
addTrial('demo', { gap: auto });
```

A field can be auto only if it says so. `.auto()` opts it in, and an auto field
reads `undefined`. `.auto(fn)` also attaches a resolver: the instrument reads the
computed value rather than writing `?? compute()` itself, and the ghosted control
has a real number to draw. `.initial(auto)` opts in and opens the field auto
instead of pinned at its default. A field that says none of these, like `seed`,
has no dot and no gesture: the default for a value the instrument cannot
receive as `undefined`, like a color going straight to a uniform.

Nothing stores the sentinel. It is normalized at every boundary into the
trial's set of unpinned paths, and the pinned value stays in the config
underneath, so un-pinning loses nothing and Reset returns the trial to the auto
fields it opened on.

## Capabilities

A capability is a field on the instrument. Declaring it is what makes the trial
provide the corresponding chrome; they compose freely.

| Field | What the trial then provides |
| --- | --- |
| `canvas` | A stack of layered `<canvas>` elements with pan and zoom, redrawing only the layers that changed |
| `stage` | Pan and zoom over the instrument's own DOM, laid out at a fixed size |
| `orbit` | A 3D orbit camera — turn, pan, dolly, home — for a renderer the instrument brings |
| `layers` | A sidebar list that hides and reorders those layers |
| `annotations` | Drawing tools, an overlay on each region you name, a Marks panel, undo and export |
| `dragDrop` | A palette to drag items from, and a drop pipeline that hands you world coordinates |
| `undo` | Undo and redo buttons, snapshotting state on the events you name — or stepping a history of the instrument's own, handed over with `useTrialHistory` |
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

`targets` is declared once per instrument and called once per trial, with the
asking trial as its third argument: `targets(state, config, trial)`. `trial.id`
is the id `useTileId` scopes a surface tile under, so a consumer holding its own
per-trial refs keys them by it and hands back the ones this trial owns; a
module-level ref like the one above is one ref shared by every trial of the
instrument, which only shows once a second trial is open. `trial.view` is that
trial's camera.

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

## A weasel scene in a trial

An instrument whose subject is an editable scene — tools, selection, undo,
modes — renders a `<TrialSceneCanvas>` and declares no `canvas` or `stage`. The
trial then runs no camera of its own, so every pointer, wheel and key gesture
over the canvas is the scene's, its pan and zoom included.

```tsx
import { createScene } from '@weasel-js/core';
import { gridSnapSource } from '@weasel-js/guides';
import { icon } from './icons.gen'; // the app's icon(): see @weasel-js/icons
import {
  type ConfigOf, defineInstrument, f, type RenderContext, type SceneTrialState,
  TrialSceneCanvas, useTrialScene,
} from '@weasel-js/labkit';

const config = f.schema({ snap: f.boolean(true).label('Snap to grid') });

function Body({ ctx }: { ctx: RenderContext<SceneTrialState, ConfigOf<typeof config>> }) {
  const scene = useTrialScene(ctx, () => createScene({ systemLayers: [{ id: 'default' }], initial: NODES }));
  const snap = useMemo(() => ({ sources: ctx.config.snap ? [gridSnapSource({ spacing: 20 })] : [] }), [ctx.config.snap]);
  return (
    <TrialSceneCanvas features={['draw']} defaultTools={['rect', 'pen']}
      scene={scene} trial={ctx.trial} snap={snap} />
  );
}

defineInstrument<SceneTrialState, ConfigOf<typeof config>>({
  name: 'Scene',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select') }, { id: 'rect', label: 'Rectangle', icon: icon('core:rect') }] },
  render: (ctx) => <Body ctx={ctx} />,
});
```

- **The scene.** `useTrialScene` builds it once per trial, writes every edit
  its history records into `state.scene`, and loads whatever arrives there from
  outside — Reset, Clone, a snapshot, a reload — into the same `Scene`. `create`
  is what a fresh or reset trial opens on.
- **Undo.** Declaring `undo` gives the buttons; `<TrialSceneCanvas>` hands the
  trial the scene's history, so the buttons and Mod+Z step `scene.undo()` and
  `scene.redo()`, and the trial stops snapshotting `state`. Any history of an
  instrument's own goes the same way: `useTrialHistory({ canUndo, canRedo,
  undo, redo, subscribe })`.
- **Tools.** A `tools` capability whose ids are the canvas's tool ids makes the
  trial's palette the canvas's tool slot, in both directions: a pick there
  activates the tool, and the canvas's own hotkeys move the palette.
  `ctx.trial.setActiveTool(id)` switches tool from anywhere else.
- **Config.** `ctx.config` is current on every render, so props built from it —
  `selectTool`, `toolOptions`, `layers`, a mode registry — reach the canvas
  live. A tool of your own reads it through thunked binding params, as
  core's `usePolygonTool` does, so a change mid-gesture reaches it too.
- **Modes.** Pass `modes={registry}` as to any `<SceneCanvas>`, holding the
  registry in state so each trial has its own; `registry.setMode(id)` switches.

The trial mounts the kit's providers isolated from its neighbors, so each
trial's canvas keeps its own selection and tool, and needs no
`<WeaselProvider>`.

## Chrome

A trial's chrome has six named regions — `titlebar`, `toolbar`, `palette`,
`sidebar`, `viewport`, `status`. A `TrialContribution` names one and supplies
data the region lays out, or a `render` function that opts out of that layout.
The `palette` region is a rail of tools and commands: a `ToolItem` writes the
tool slot when pressed and reads as current while the slot names it, and a
`CommandItem` carries an `onActivate`, runs once per press, and never latches:

```tsx
<Lab
  chrome={[{ id: 'seed', region: 'status', item: { text: `seed ${seed}` } }]}
  suppress={['fps']}
  // …
/>
```

Contributions passed to `<Lab>` apply to every trial; an instrument's own
`chrome` field applies to its trials only. `suppress` drops a built-in by id and
throws on an id that is not there. A suppressed button takes its shortcut with
it: with `snapshot` gone, Mod+S is the browser's again.

`header={false}` drops the lab's own header bar — title, add-trial, zoom, and
theme switcher — the menu bar, and the zoom keys with them, for a lab embedded in
a page that frames it.

A lab also draws a menu bar above its header: Lab (add a trial, the header's
items), then the menus you declare with `menus`, then View (zoom, color mode).
It adds to the header and takes nothing from it. A row names a command by id, and
any child of `<Lab>` registers one with `useCommand` (`header={false}` unmounts `<Lab>`'s children, and their commands with them):

```tsx
const menus = {
  schema: pref.group('', {
    tools: pref.group('Tools', { reseed: pref.action('app.reseed') }, { as: 'menu' }),
  }),
};

function Reseed() {
  useCommand('app.reseed', 'Reseed', () => setSeed(Math.random()), {
    keys: { kind: 'key', key: 'r', mods: { mod: true, shift: true } },
  });
  return null;
}

<Lab menus={menus}>
  <Reseed />
</Lab>;
```

A menu keyed `lab` or `view` adds its rows to that built-in menu. `menus` also
takes `values` and `onChange` for boolean and enum rows. `menuBar={false}` drops
the bar; presenting hides it too. The header's own items are commands as well,
`lab.item.<id>`, and an item's `keys` binds one wherever focus is in the lab, so
a key typed in a text field still types. `contextMenus` takes `MenuDef`s that a
right-click, Shift+F10 or the ContextMenu key opens over a trial's camera; a lab
that declares none keeps the browser's own menu.

A sidebar section can be torn out of the trial into the workspace — as a tile
beside the trials, or as a floating panel — with the trial still rendering into
it. `SidebarSection.undockable` and `undockAs` control the offer;
`undockPanel` / `dockPanel` move one.

## Theming

labkit ships one theme, `interstellar` — a cosmic dark over weasel's own light
mode — as a value, not a stylesheet. `<Lab>` and `<LabShell>` apply it for you;
`mode` is `"auto"` (follow the OS), `"light"` or `"dark"`. Only `styles.css`
needs importing, and the token values arrive through the provider:

```tsx
import { interstellarTheme } from '@weasel-js/labkit';
import { ThemeProvider } from '@weasel-js/theme/react';

<ThemeProvider theme={interstellarTheme} selection={{ mode: 'dark' }}>…</ThemeProvider>
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

With `reorderable`, a tile is dragged by its `<TileGrip>`: wrap the tile's
header in one, and commit the order `onReorder` reports. A `<Trial>`'s title
bar is a grip already.

```tsx
import { TileGrip } from '@weasel-js/labkit';

function MyPane({ id }: { id: string }) {
  return (
    <section>
      <TileGrip className="my-pane__bar">{id}</TileGrip>
      …
    </section>
  );
}
```

Every tile has an expand button in its corner that shows it large over the
page; Escape, a click in the margin, or the close button puts it back. The tile
is lifted into the browser's top layer rather than remounted, so a WebGL
context inside it keeps running and only sees its box grow. A double-click
opens it too where you ask for that — `expandOnDoubleClick={(id) => id ===
'output'}` for an image tile. Turn the lightbox off with `lightbox={false}`, or
per tile with `lightbox={(id) => …}`; the same behavior is available outside a
workspace as `<Lightbox>`. In a `<Lab>` every trial has the toggle in its title
bar, and its shared-surface pixels — annotation marks, a 3D view — come along.

`<Toolbar>`, `<Sidebar>`, `<StatusBar>`, `<FpsMeter>`, `<ScaleIndicator>`,
`<Legend>`, `<FloatingPanel>`, `<ZoomControl>` and the `@weasel-js/ui` property
rows re-exported from the root are all usable this way. `<Trial>` is not: it
reads the lab store and only mounts inside a `<Lab>`.

## Driving your own renderer

### Cameras

`canvas`, `stage` and `orbit` each give the trial a camera, and a trial has at
most one: `canvas` wins over `stage`, and `orbit` beside either throws. The
camera lives in the trial's `view`, so it persists, Clone copies it and Reset
returns it to `initialView`; the lab's zoom controls drive whichever one has
the focus. `zoom` in a render context is that camera's magnification — a 2D
view's zoom, or an orbit's opening distance over its distance now.

An orbit's view is kernel3d's `Camera3d` — `{ target, yaw, pitch, distance,
fov, near, far }`, plain numbers in radians and scene units. Read it with
`useTrialOrbit()` anywhere in the trial, or `as3DView(ctx.trial.view)` in
`render`, and project it with kernel3d's `cameraViewProjection`:

```tsx
orbit: {
  initialView: { distance: 14, pitch: 0.45 },
  limits: { minDistance: 2, maxDistance: 80 },
},
```

A drag turns it, Shift+drag pans its target, the wheel and a pinch dolly
about the point under the pointer — as a 2D camera zooms about it — and a
double click goes home. When the instrument draws in a pane rather than its
whole body, it hands that pane to `useTrialOrbit().viewportRef`: gestures land
there, and the dolly anchors there. An instrument running a dispatcher of its
own over the pane — tools that select or draw in 3D — keeps the press for them
with `gestures: { drag: false, home: false, pinch: 'trackpad' }` and moves the
trial's camera from its own tools; `examples/3d-lab` does both. The loupe, the
overview and the linked cursor are 2D, and stay out of an orbit trial.

The renderer is the instrument's: `CanvasStack` draws 2D layers, and for three.js
or raw WebGL you take rects and dirtiness from labkit and keep the GL yourself:

```tsx
import { toDeviceRect, useSurfaceTile, useTiledSurface } from '@weasel-js/labkit/surface';
```

A trial's `view` is persisted, restored on Reset and handed to the instrument;
labkit reads into it only through the camera the instrument declares.
See `src/surface/AGENTS.md`
for the contract and the traps.

## Subpath exports

The root barrel carries the common surface; a subpath reaches one slice
directly. Several expose more than the root does, `/state` most of all.

| Subpath | |
| --- | --- |
| `@weasel-js/labkit` | Everything but `/loupe` and `/overview` |
| `/styles.css` | The one stylesheet |
| `/primitives` | Toolbar, Sidebar, StatusBar, Legend, FloatingPanel, meters |
| `/chrome` | Regions, contribution types, built-in contributions |
| `/controls` | `<ControlPanel>` and the config field types |
| `/canvas` | `<CanvasStack>`, `<Stage>`, `<Orbit>`, `<CameraInput>`, coordinate helpers |
| `/layers` | `<LayerList>` from `@weasel-js/ui`, and the layers capability types |
| `/loupe` | `<TrialLoupe>`, the magnifier an instrument mounts in its content; the trial offers a Loupe toggle while one is mounted. Not in the root barrel |
| `/overview` | `<TrialOverview>`, a floating panel showing a trial's whole content. Not in the root barrel |
| `/surface` | Tiled surface hooks for your own renderer |
| `/job` | `useJob` and the job capability types |
| `/state` | The lab store, storage adapters (re-exported from `@weasel-js/storage`), `useTrialState`, serialization helpers |
| `/undo` | Undo stack |
| `/dragdrop` | `<Palette>`, `<DragGhost>`, `useDragDrop` |
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
```

The forge workshop runs at the repo root: `npm run dev:forge` from there covers
every package's stories, labkit's included.

## Documentation

- [Docs site](https://orochi235.github.io/weasel/#pkg/labkit)
- [Recipes](https://orochi235.github.io/weasel/#pkg/labkit/guides/recipes) — composition patterns
- [Agent guide](https://orochi235.github.io/weasel/#pkg/labkit/guides/agents) — a map of the source
- [Component workshop](https://orochi235.github.io/weasel/docs/ui/forge/)
- [Design spec](https://github.com/orochi235/weasel/blob/main/packages/labkit/docs/superpowers/specs/2026-04-26-labkit-design.md)
