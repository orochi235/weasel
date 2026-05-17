# Dep sources

> **Audience:** consumer-app authors wiring custom action dependencies.

Actions declare what they need via `requires: ['selection', 'view', ...]`. At dispatch time the kit reads each name from the **dep registry** and hands the resulting bag to the action's `invoker.run`. Each named dep is published by a **dep source** — a small hook that calls `useDepSource(name, () => latestValue)`.

## Kit-shipped dep sources

`<SceneCanvas>` mounts the kit's standard set of dep sources for you. Each one lives in its own module under `src/canvas/deps/`:

| File | Dep | Used by |
| --- | --- | --- |
| `useViewDepSource.ts` | `view` | viewport pan/zoom, drag-pan |
| `useAreaSelectDepSource.ts` | `areaSelect` | rubber-band marquee select |
| `useLassoSelectDepSource.ts` | `lassoSelect` | freehand lasso select |
| `useInsertDepSource.ts` | `insert` | rect/ellipse/line/polygon/star/pencil tools |
| `useTextEditDepSource.ts` | `textEdit` | enter-text-edit action (stub by default — see below) |
| `useEditAnchorsDepSource.ts` | `editAnchors` | polygon anchor-edit |

The remaining standard deps (`selection`, `scene`, `history`, `pointer`, `activeTool`) are registered by `useStandardActions` directly. The split is mostly cosmetic — both routes funnel through `useDepSource`.

## Writing your own

To add a consumer-specific dep, you need three small pieces:

### 1. Augment `DepSchema` with the dep's type

```ts
// myapp/src/colorContext/depSchemaAugmentation.ts
import type { ColorContextValue } from './ColorContext';

declare module '@orochi235/weasel' {
  interface DepSchema {
    color: ColorContextValue;
  }
}

export {}; // ensure the file is a module
```

A side-effect import of this file in your app's entrypoint makes `useDepSource('color', ...)` typecheck.

### 2. Publish a live source

Mount a thin bridge component **inside** `<DepRegistryProvider>` (which `<SceneCanvas>` provides) that calls `useDepSource`:

```tsx
import { useDepSource } from '@orochi235/weasel';
import { useColorContext } from './ColorContext';

function ColorDepBridge() {
  const color = useColorContext();
  useDepSource('color', () => color);
  return null;
}
```

The thunk passed to `useDepSource` is called at action-dispatch time — return the latest value rather than capturing.

### 3. Wire an action that requires the dep

```ts
import { type Action } from '@orochi235/weasel';

export const setFillFromSwatchAction: Action = {
  id: 'color.setFillFromSwatch',
  label: 'Set fill from swatch',
  defaultBinding: null,
  requires: ['color', 'selection'] as const,
  invoker: {
    timing: 'immediate',
    run: ({ deps, extras }) => {
      const { color, selection } = deps;
      const swatchPaint = (extras as { paint: unknown }).paint;
      color.setFill(swatchPaint as never);
      // ...apply to selection via your existing op pipeline
    },
  },
  run: () => { /* legacy bridge — actions with invokers usually leave this empty */ },
};
```

When this action runs, the dispatcher reads `'color'` and `'selection'` from the registry, packs them into `deps`, and invokes your `run`.

## Where the kit's templates live

Each file under `src/canvas/deps/` is a one-screen example of the pattern: ref-stabilise the inputs, call `useDepSource`, return. The Swill app's `ColorDepBridge` (in `apps/swillustrator/src/App.tsx`) is the canonical consumer-side example.
