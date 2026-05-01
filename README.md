# weasel

Domain-agnostic 2D scene graph primitives for React. Viewport math, pointer-driven drag, resize, insert, clone, layered canvas rendering, and a few generic renderers — adapter-driven so you can plug your own object types in.

> Pre-1.0: the API surface (paths, groups, units-per-subobject) is still settling. Expect breaking changes between minor versions until 1.0.

## Install

```sh
npm install @orochi235/weasel react
```

`react` is a peer dependency (>=18).

## Quickstart

```tsx
import { useMoveInteraction } from '@orochi235/weasel';

// see the demo for a full working example:
// https://orochi235.github.io/weasel/
```

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
