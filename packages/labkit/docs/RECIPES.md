# Labkit — Recipes

Composition patterns for common lab shapes. This file grows as plans land.

## Plan 1 recipes

### A minimal lab shell with a tiled grid

```tsx
import { LabShell, WorkspaceGrid } from '@labkit/react';
import '@labkit/react/styles.css';

export function MyLab() {
  return (
    <LabShell title="My Lab">
      <WorkspaceGrid>
        <div>Workspace 1</div>
        <div>Workspace 2</div>
        <div>Workspace 3</div>
      </WorkspaceGrid>
    </LabShell>
  );
}
```

### A toolbar with undo/redo and a save button

```tsx
import { Toolbar } from '@labkit/react';

<Toolbar>
  <Toolbar.Title>My Workspace</Toolbar.Title>
  <Toolbar.Button onClick={onUndo} disabled={!canUndo}>Undo</Toolbar.Button>
  <Toolbar.Button onClick={onRedo} disabled={!canRedo}>Redo</Toolbar.Button>
  <Toolbar.Spacer />
  <Toolbar.Button onClick={onSave}>Save</Toolbar.Button>
</Toolbar>
```

### A status bar with multiple sections

```tsx
import { StatusBar, FpsMeter } from '@labkit/react';

<StatusBar>
  <StatusBar.Section>Items: {items.length}</StatusBar.Section>
  <StatusBar.Section>Zoom: {Math.round(zoom * 100)}%</StatusBar.Section>
  <StatusBar.Section><FpsMeter /></StatusBar.Section>
</StatusBar>
```

## Plan 5 recipes — capabilities

### Build a drag-and-drop layout lab

A lab where users drag items from a palette onto a canvas, with layer toggles and undo. (See `examples/drag-lab/` for the full version.)

```tsx
import { defineInstrument, Lab } from '@labkit/react';
import '@labkit/react/styles.css';

interface Plant { id: string; kind: 'tree' | 'flower'; x: number; y: number }
interface State { plants: Plant[] }

const Garden = defineInstrument<State, { showGrid: boolean }>({
  name: 'Garden',
  defaultConfig: () => ({ showGrid: true }),
  initialState: () => ({ plants: [] }),
  configSchema: () => [
    { type: 'checkbox', key: 'showGrid', label: 'Show grid', default: true },
  ],
  render: () => null,
  canvas: {
    layers: [
      { id: 'grid', draw: (ctx, { config }) => { /* draw grid if config.showGrid */ } },
      { id: 'plants', draw: (ctx, { state }) => { /* draw state.plants */ } },
    ],
  },
  layers: { ids: ['grid', 'plants'] },
  dragDrop: {
    palette: [
      { id: 'tree', label: '🌳 Tree' },
      { id: 'flower', label: '🌸 Flower' },
    ],
    onDrop: (worldPos, item, state) => ({
      plants: [
        ...state.plants,
        { id: `${item.id}-${Date.now()}`, kind: item.id as Plant['kind'], ...worldPos },
      ],
    }),
  },
  undo: { snapshotOn: ['canvas.itemAdded'], maxDepth: 50 },
});

export function GardenLab() {
  return <Lab instruments={[Garden]} defaultInstrument="Garden" storageKey="garden" />;
}
```

The Workspace automatically:
- Renders the `<Palette>` in the sidebar above any layer list
- Places `<LayerList>` in the sidebar (because `instrument.layers` is set)
- Wires Undo/Redo toolbar buttons (because `instrument.undo` is set)
- Snapshots state on `canvas.itemAdded` (emitted by the drop pipeline)

### Build a layered visualization lab (canvas + layer toggles)

For data viz where users want to toggle traces, reference grids, or annotation layers:

```tsx
const Viz = defineInstrument<{ data: number[] }, { binCount: number }>({
  name: 'Histogram',
  defaultConfig: () => ({ binCount: 20 }),
  initialState: () => ({ data: generateSamples() }),
  configSchema: () => [
    { type: 'slider', key: 'binCount', label: 'Bins', min: 5, max: 100, step: 1, default: 20 },
  ],
  render: () => null,
  canvas: {
    layers: [
      { id: 'axes',     draw: drawAxes },
      { id: 'bars',     draw: drawBars },
      { id: 'mean',     draw: drawMeanLine },
      { id: 'callouts', draw: drawCallouts },
    ],
  },
  layers: { ids: ['axes', 'bars', 'mean', 'callouts'] },
});
```

Users can hide individual layers via the sidebar's `<LayerList>` and reorder them by dragging the handle. The canvas redraws only the dirty layers on each frame.

To pin a layer (always visible, not reorderable), the wiring currently reads `LayerDescriptor.alwaysOn` — set it on the descriptor passed to `<LayerList>`. (For now, layers are derived from `instrument.layers.ids`; fork the workspace if you need per-id `alwaysOn` configuration.)

### Add a custom undoable action via `ctx.emit(...)`

By default, the workspace snapshots state on `'state.change'`. To make a non-state operation undoable, emit a custom event from the instrument and list it in `undo.snapshotOn`:

```tsx
const Editor = defineInstrument<{ items: Item[] }, {}>({
  name: 'Editor',
  defaultConfig: () => ({}),
  initialState: () => ({ items: [] }),
  render: (ctx) => (
    <button
      onClick={() => {
        ctx.setState((s) => ({ items: shuffle(s.items) }));
        ctx.emit('items.shuffled');
      }}
    >
      Shuffle
    </button>
  ),
  undo: {
    snapshotOn: ['state.change', 'items.shuffled'],
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
