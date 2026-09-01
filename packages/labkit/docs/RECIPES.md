# Labkit — Recipes

Composition patterns for common lab shapes. This file grows as plans land.

## Plan 1 recipes

### A minimal lab shell with a tiled grid

```tsx
import { LabShell, Workspace } from "@weasel-js/labkit";
import "@weasel-js/labkit/styles.css";

export function MyLab() {
  return (
    <LabShell title="My Lab">
      <Workspace>
        <div>Trial 1</div>
        <div>Trial 2</div>
        <div>Trial 3</div>
      </Workspace>
    </LabShell>
  );
}
```

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

## Plan 5 recipes — capabilities

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

(More recipes added as plans land — custom storage adapters, MIDI/audio capabilities, etc.)
