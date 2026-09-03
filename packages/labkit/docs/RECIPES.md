# Labkit — Recipes

Composition patterns for common lab shapes.

## Shell and primitives

### A minimal lab shell with a tiled grid

```tsx
import { LabShell, Workspace } from "@weasel-js/labkit";
import "@weasel-js/labkit/styles.css";

export function MyLab() {
  return (
    <LabShell title="My Lab">
      <Workspace ids={["a", "b", "c"]} resizable>
        <MyPane id="a" />
        <MyPane id="b" />
        <MyPane id="c" />
      </Workspace>
    </LabShell>
  );
}
```

`ids` are matched positionally and are what `resizable` and `reorderable` key
off; without them a tile is identified by its position, so closing one from the
middle shifts every id after it. `<Trial>` is not usable here — it reads the lab
store and only mounts inside a `<Lab>`.

### A toolbar with undo/redo and a save button

```tsx
import { Toolbar } from "@weasel-js/labkit";

<Toolbar>
  <Toolbar.Title>My Trial</Toolbar.Title>
  <Toolbar.Button onClick={onUndo} disabled={!canUndo}>
    Undo
  </Toolbar.Button>
  <Toolbar.Button onClick={onRedo} disabled={!canRedo}>
    Redo
  </Toolbar.Button>
  <Toolbar.Spacer />
  <Toolbar.Button onClick={onSave}>Save</Toolbar.Button>
</Toolbar>;
```

### A status bar with multiple sections

```tsx
import { StatusBar, FpsMeter } from "@weasel-js/labkit";

<StatusBar>
  <StatusBar.Section>Items: {items.length}</StatusBar.Section>
  <StatusBar.Section>Zoom: {Math.round(zoom * 100)}%</StatusBar.Section>
  <StatusBar.Section>
    <FpsMeter />
  </StatusBar.Section>
</StatusBar>;
```

### A legend in a panel the user can move

`<Legend>` is a color key: one row per entry, each swatch drawn the way its ink
is drawn on the canvas — `line` (the default), `dash`, `dot` or `band`. It is
presentational, with no handlers and no state.

`<FloatingPanel>` floats over its offset parent, snaps to the corners it is
allowed, and can remember where it was left. Drag it from anywhere that is not a
control; `input`, `button`, `a`, `select`, `textarea` and any `[data-no-drag]`
element pass their pointer through instead.

**Parent it to the canvas stack's overlay.** It positions against its offset
parent, so nested inside another absolutely-positioned overlay child it would
measure that child's box rather than the canvas.

```tsx
import { FloatingPanel, Legend } from "@weasel-js/labkit";

<div className="lk-canvas-stack__overlay">
  <FloatingPanel anchor="bottom-right" storageKey="mylab.legend">
    <Legend
      entries={[
        { key: "contour", label: "contour", color: "#7d7f86" },
        { key: "floor", label: "bend floor", color: "#9a9ca3", mark: "dash" },
        { key: "authored", label: "authored", color: "#2aa87a", mark: "dot" },
      ]}
    />
  </FloatingPanel>
</div>;
```

| `FloatingPanel` prop | Default         |                                              |
| -------------------- | --------------- | -------------------------------------------- |
| `anchor`             | `'bottom-left'` | corner it rests in until dragged             |
| `snapCorners`        | all four        | corners allowed to capture it                |
| `inset`              | `12`            | pixels in from a corner when snapped         |
| `storageKey`         | —               | `localStorage` key; omit to forget on reload |

| `Legend` entry field |          |                                     |
| -------------------- | -------- | ----------------------------------- |
| `key`                | required | React key                           |
| `label`              | required | the text                            |
| `color`              | required | swatch ink                          |
| `mark`               | `'line'` | `line` \| `dash` \| `dot` \| `band` |

## Styling labkit from your own stylesheet

Two prefixes, and they are not interchangeable:

- **`lk-*`** — DOM class names.
- **`--wzl-*`** — design tokens: color, spacing, type, motion.

So `var(--lk-border, #333)` is the trap. No `--lk-*` custom property is ever
declared, and a `var()` fallback exists precisely to be silent, so every rule
written that way takes its fallback and nothing warns. The usual symptom is a
panel that looks right in the mode you built in and wrong in the other one.

Style against tokens rather than your own constants, so your surfaces follow
the theme the lab is in:

```css
.my-panel {
  background: var(--wzl-surface);
  border: var(--wzl-border-w) solid var(--wzl-line-subtle);
  color: var(--wzl-fg);
}
```

**Tokens are scoped to `.lk-root`**, which `<LabShell>` applies — `<Lab>`
renders one for you. A labkit component mounted outside that root (a bare
`<ControlPanel>` in your own pane, say) resolves no tokens at all, and the same
silent fallback applies.

**Component class names are not public API.** Every component takes a
`className`; add your own class through it and style that. Selectors written
against `lk-*` names work until they don't, with no deprecation.

## Capabilities

### Build a drag-and-drop layout lab

A lab where users drag items from a palette onto a canvas, with layer toggles and undo. (See `examples/drag-lab/` for the full version.)

```tsx
import { type ConfigOf, defineInstrument, f, Lab } from "@weasel-js/labkit";
import "@weasel-js/labkit/styles.css";

interface Plant {
  id: string;
  kind: "tree" | "flower";
  x: number;
  y: number;
}
interface State {
  plants: Plant[];
}

const gardenConfig = f.schema({ showGrid: f.boolean(true) });

const Garden = defineInstrument<State, ConfigOf<typeof gardenConfig>>({
  name: "Garden",
  config: gardenConfig,
  initialState: () => ({ plants: [] }),
  render: () => null,
  canvas: {
    layers: [
      {
        id: "grid",
        draw: (ctx, { config }) => {
          /* draw grid if config.showGrid */
        },
      },
      {
        id: "plants",
        draw: (ctx, { state }) => {
          /* draw state.plants */
        },
      },
    ],
  },
  layers: { ids: ["grid", "plants"] },
  dragDrop: {
    palette: [
      { id: "tree", label: "🌳 Tree" },
      { id: "flower", label: "🌸 Flower" },
    ],
    onDrop: (worldPos, item, state) => ({
      plants: [
        ...state.plants,
        {
          id: `${item.id}-${Date.now()}`,
          kind: item.id as Plant["kind"],
          ...worldPos,
        },
      ],
    }),
  },
  undo: { snapshotOn: ["canvas.itemAdded"], maxDepth: 50 },
});

export function GardenLab() {
  return (
    <Lab
      instruments={[Garden]}
      defaultInstrument="Garden"
      storageKey="garden"
    />
  );
}
```

The Trial automatically:

- Renders the `<Palette>` in the sidebar above any layer list
- Places `<LayerList>` in the sidebar (because `instrument.layers` is set)
- Wires Undo/Redo toolbar buttons (because `instrument.undo` is set)
- Snapshots state on `canvas.itemAdded` (emitted by the drop pipeline)

### Build a layered visualization lab (canvas + layer toggles)

For data viz where users want to toggle traces, reference grids, or annotation layers:

```tsx
const vizConfig = f.schema({
  binCount: f.number(20).range(5, 100).step(1).label("Bins"),
});

const Viz = defineInstrument<{ data: number[] }, ConfigOf<typeof vizConfig>>({
  name: "Histogram",
  config: vizConfig,
  initialState: () => ({ data: generateSamples() }),
  render: () => null,
  canvas: {
    layers: [
      { id: "axes", draw: drawAxes },
      { id: "bars", draw: drawBars },
      { id: "mean", draw: drawMeanLine },
      { id: "callouts", draw: drawCallouts },
    ],
  },
  layers: { ids: ["axes", "bars", "mean", "callouts"] },
});
```

Users can hide individual layers via the sidebar's `<LayerList>` and reorder them by dragging the handle. The canvas redraws only the dirty layers on each frame.

To pin a layer (always visible, not reorderable), the wiring currently reads `LayerDescriptor.alwaysOn` — set it on the descriptor passed to `<LayerList>`. (For now, layers are derived from `instrument.layers.ids`; fork the trial if you need per-id `alwaysOn` configuration.)

### Add a custom undoable action via `ctx.emit(...)`

By default, the trial snapshots state on `'state.change'`. To make a non-state operation undoable, emit a custom event from the instrument and list it in `undo.snapshotOn`:

```tsx
const Editor = defineInstrument<{ items: Item[] }, {}>({
  name: "Editor",
  defaultConfig: () => ({}),
  initialState: () => ({ items: [] }),
  render: (ctx) => (
    <button
      onClick={() => {
        ctx.setState((s) => ({ items: shuffle(s.items) }));
        ctx.emit("items.shuffled");
      }}
    >
      Shuffle
    </button>
  ),
  undo: {
    snapshotOn: ["state.change", "items.shuffled"],
    maxDepth: 50,
  },
});
```

The snapshot is taken **before** the state change, so undoing returns to the pre-shuffle state. `snapshotOn` is a set: each event in the list triggers at most one snapshot per call, even if multiple events match the same change.

System events worth knowing:

- `'state.change'` — fired after `ctx.setState` (built-in)
- `'config.change'` — fired after `ctx.setConfig` (built-in)
- `'config.change:<key>'` — also fired with the specific key suffix
- `'canvas.itemAdded'` — fired by the drag-drop pipeline after a successful drop
- `'layers.toggle'` / `'layers.reorder'` — fired by `<LayerList>` interactions

## Annotations

### Let users draw on an instrument's picture

An instrument names the regions that accept marks. Everything else — the tool
palette, the overlay, the store, undo, persistence, export — is labkit's.

`targets()` is called with the trial's state and config, not from inside a
component, so the refs it hands back have to be reachable from outside React:

```tsx
import { createRef } from "react";
import { type CaptureSource, defineInstrument, f } from "@weasel-js/labkit";

const paneRef = createRef<HTMLDivElement>();
const CONTENT = { w: 260, h: 180 };

export const Inspector = defineInstrument({
  name: "Inspector",
  config: f.schema({
    angle: f.number(0).range(-45, 45).step(1),
    label: f.string("bracket-7"),
  }),
  initialState: () => ({}),
  render: (ctx) => (
    <div ref={paneRef}>
      <Part angle={ctx.config.angle} />
    </div>
  ),
  annotations: {
    targets: () => [
      {
        id: "pane",
        ref: paneRef,
        content: CONTENT,
        positionDependsOn: ["angle"],
        base: (): CaptureSource => ({
          kind: "svg",
          markup: paneRef.current?.querySelector("svg")?.outerHTML ?? "",
        }),
      },
    ],
    meaning: {
      statuses: [
        { id: "open", label: "Open", color: "#e5484d" },
        { id: "confirmed", label: "Confirmed", color: "#f5a524" },
        { id: "fixed", label: "Fixed", color: "#30a46c" },
      ],
    },
  },
});
```

| Target field | |
| --- | --- |
| `id` | Names the target. A mark's id is `<target>/<node>` |
| `ref` | The element the overlay tracks and takes input from |
| `content` | Intrinsic size in CSS pixels at zoom 1 — the box positions are fractions *of* |
| `positionDependsOn` | Config keys whose change means a stored position no longer refers to the same picture |
| `base` | The picture underneath the marks, for an export to draw over |
| `view` | The pane's camera, mirrored so marks pan and zoom with what they mark |

Positions cross the store boundary as fractions rather than pixels so a mark
stays on the same feature when the picture is rendered at a different
resolution. `positionDependsOn` is compared by value and labkit never looks
inside it: a mark whose declared keys have moved draws dashed rather than
vanishing, because it still describes something.

Declare `positionDependsOn` per target, not per instrument. In a two-pane lab
where one config key only moves the right pane, only that target lists it, and a
mark on the left survives a change that would strand one on the right.

### Read the marks from your own UI

`useAnnotations()` returns a stable facade over mutable scenes and re-renders
its caller whenever a mark changes. Reading `query()` without it renders one
answer and never revises it.

```tsx
import { useAnnotations } from "@weasel-js/labkit";

function MarkCount({ config }: { config: Config }) {
  const marks = useAnnotations();
  const all = marks.query();
  const stale = all.filter((m) => marks.isStale(m, config)).length;
  return <span>{all.length} marks{stale > 0 ? `, ${stale} stale` : ""}</span>;
}
```

It throws outside a trial whose instrument declares `annotations`. For chrome
that renders in every trial and does something else where there are no marks,
use `useAnnotationsOptional()`.

`query(q?)` filters by `target`, `kind`, `status`, `tags` and an arbitrary
`where`, ANDed. `hitTest(target, pt, tol?)` returns marks under a point, topmost
first; `within(target, box)` returns marks wholly inside a marquee. Both take
fractions, not pixels.

### Export a picture with its marks on it

```tsx
const { blob, width, height } = await marks.capture("pane", {
  format: "svg",
  scale: 2,
});
```

The route depends on the target's `base`. An SVG base nests beside the marks in
one document, which makes `format: 'svg'` a real vector export; anything else
stacks rasters, with the marks drawn offscreen at export scale rather than read
back off the live surface — so a capture neither depends on nor disturbs what is
on screen. Resolution follows the target's `content` box times `scale`, not the
size the pane happens to be on screen. A target declaring no `base` still
exports, its marks on transparency.

Declaring `annotations` earns an Export button in the trial toolbar.
`AnnotationsCapability.onCapture` fires after every export, labkit's own chrome
included, for a host that wants to file the blob somewhere of its own.

### Keep the marks somewhere else

Marks live in `TrialRecord.annotations` by default, written on a trailing
debounce and flushed on unmount. An instrument whose marks belong in a format it
already owns declares storage instead, and labkit never writes its own slot:

```tsx
annotations: {
  targets: () => [...],
  storage: {
    load: () => JSON.parse(localStorage.getItem("my-marks") ?? "null"),
    save: (doc) => localStorage.setItem("my-marks", JSON.stringify(doc)),
  },
}
```

Both halves are called outside React, and `save` is already debounced by the
time it arrives.

Undo is weasel history, not a second stack: `marks.undo()` / `redo()` take back
the most recent mark change wherever it was made. Declaring `annotations` earns
the trial's undo and redo buttons whether or not the instrument also declares
`undo`; a trial declaring both gives the marks the buttons first.

## Chrome

### Add a toolbar button, a readout, or a sidebar panel

A `TrialContribution` names one of six regions — `titlebar`, `toolbar`,
`palette`, `sidebar`, `viewport`, `status` — and supplies data the region lays
out. Contributions on `<Lab chrome>` reach every trial; an instrument's own
`chrome` field reaches only its own.

```tsx
import type { TrialContribution } from "@weasel-js/labkit";

const chrome: TrialContribution[] = [
  { id: "seed", region: "status", item: { text: `seed ${seed}` } },
  {
    id: "notes",
    region: "sidebar",
    item: { title: "Notes", body: <Notes />, undockAs: "floating" },
  },
  {
    id: "reseed",
    region: "toolbar",
    item: { icon: DiceIcon, label: "Reseed", shortcut: "R", onActivate: reseed },
  },
];

<Lab chrome={chrome} suppress={["fps"]} instruments={[…]} defaultInstrument="…" />;
```

Groups sort by first appearance and items sort within a group by declaration
order; `end` pushes a contribution and its group to the far end of the region.
`suppress` drops a built-in by id — `undo`, `redo`, `loupe`, `zoom-in`,
`zoom-out`, `actual-size`, `zoom-control`, `scale`, `fps`, `export`, `marks`,
`settings`, `snapshot-load`, `clone`, `reset`, `snapshot`, `close` — and throws
on an id that is not there.

Supplying `render: (ctx) => ReactNode` instead of `item` opts out of the
region's layout. It is deliberate, and visible in the declaration. `ctx` is the
`TrialChromeContext`: the trial's id, zoom, undo bindings, resolved config,
snapshots, tool slot, and the trial operations.

### Let a sidebar panel be torn out

A sidebar section offers a tear-out control by default. It goes into the
workspace as a tile beside the trials, or as a floating panel, with the trial
still rendering into it:

```tsx
{ id: "notes", region: "sidebar",
  item: { title: "Notes", body: <Notes />, undockAs: "floating" } }
```

Set `undockable: false` on a section that only makes sense beside its trial.
From a contribution's own `render`, `ctx.undockPanel(sectionId, as?)` and
`ctx.dockPanel(sectionId)` move one, and `ctx.undockedPanels` says which are
out.
