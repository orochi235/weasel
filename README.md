# weasel

A 2D scene-graph toolkit for React + canvas apps. Bring your own object type and pose shape; weasel handles the viewport math, pointer gestures (move / resize / insert / clone / area-select / text edit), layered canvas rendering, an op-based undo/redo model, and a stack of selection-driven action hooks (delete, duplicate, nudge, group, clipboard, undo/redo, …) wired to keyboard shortcuts when you ask.

Built for diagram editors, sketch tools, schematic editors, scene composers — anything where "objects on a canvas the user can grab, move, and arrange" is the substrate.

> Pre-1.0: the API surface (paths, structural groups, per-subobject units) is still settling. Expect breaking changes between minor versions until 1.0.

## Install

```sh
npm install @orochi235/weasel react
```

`react` is a peer dependency (>=18).

## How it fits together

Every interaction takes a small, narrow **adapter** — a few methods that read the current scene and apply ops back. The kit doesn't own your scene; it asks. That keeps it agnostic to whether your scene lives in React state, Zustand, Redux, or a CRDT.

```tsx
import { useMoveInteraction, useDeleteAction, createHistory } from '@orochi235/weasel';

const history = createHistory(adapter);

// Drag-to-move with snapping, history, and parent reparenting:
const move = useMoveInteraction({
  adapter,                       // get/set pose, applyBatch(ops)
  behaviors: [snapToGrid(20)],
});

// Selection-aware delete with Backspace/Delete bound:
const del = useDeleteAction(adapter, { bindKeyboard: true });
```

See the live demo for a full working example: <https://orochi235.github.io/weasel/>

## Demo

Live demo: <https://orochi235.github.io/weasel/>

## Subpath imports

For tree-shaking and clarity, hook-specific helpers are scoped:

```ts
import { snapToGrid } from '@orochi235/weasel/move';
import { snapToGrid, clampMinSize } from '@orochi235/weasel/resize';
import { snapToGrid } from '@orochi235/weasel/insert';
```

## Documentation

- [Concepts](./docs/concepts.md)
- [Hooks](./docs/hooks.md)
- [Adapters](./docs/adapters.md)
- [Extending](./docs/extending.md)

## License

MIT.
