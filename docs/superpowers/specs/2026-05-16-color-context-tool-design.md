# Color context as a userland tool — design

**Status:** approved
**Owner:** swillustrator
**Scope:** `apps/swillustrator/src/` only (no kit changes)

## Problem

Active-paint state (fill / stroke / focus, plus the D / X / Shift-X / `/`
keybindings) lives in `apps/swillustrator/src/useActiveColors.ts` as a free-standing hook. App-level scene-write helpers (`applyFillToSelection`,
`applyStrokeToSelection`, `applyStrokeWidthToSelection`) live in `App.tsx` and
are passed down through a long prop chain via `RightSidebar`. Color sources
(eyedropper, swatch grid, native color input, opacity slider, palette) each
talk to the App's setters directly, and none of them share a discovery surface.

Goal: one centralized "active colors" tool that owns the state, exposes a
single imperative api for *every* color-change caller (UI + other tools),
publishes that api to the React subtree via context, and registers its
keybindings through the kit's tool dispatcher rather than free-floating
`useAction` calls.

## Decisions

| | choice | rationale |
|---|---|---|
| Where does the state live? | Inside the new hook (React `useState` + refs), exactly as `useActiveColors` does today. | The tool primitive isn't a state container; the kit's existing pattern (`useDeleteTool` → controller + `Tool`) keeps the React state next to React. |
| Where does the tool live in the dispatcher? | **Ambient list** (the kit's `ToolSlot = 'ambient'` bucket holds an array — see `dispatcher.test.ts:34, 59`). | The tool never claims pointer/drag; it only intercepts a few keys, alongside other always-on tools (delete, nudge, clone). |
| History capture | Object-edit only. Active-paint state changes (D, X, Shift-X, `/`, picking a swatch with no selection, eyedropper into active paint) do **not** enter history. `applyFillToSelection` / `applyStrokeToSelection` / `applyStrokeWidthToSelection` keep their existing `coalesceKey`-driven undo grouping. | Photoshop / Figma don't undo brush-color changes; only scene mutations belong on the undo stack. |
| Consumer surface | React context (`<ColorContextProvider>` + `useColorContext()`) **plus** the same `api` object returned for non-React callers (other tools, dispatcher route closures). | The api is just an imperative object; the context layer is a convenience for the React UI tree, not a wall around the api. |
| Tool palette visibility | Hidden from the tool palette (no `presentation.icon`); discoverable in the command palette via `buildActionRegistry`. | The tool has no pointer/drag — it would be a dead button in the palette. |

## Architecture

```
apps/swillustrator/src/tools/colorContext/
├── useColorContextTool.ts      # hook → { tool, api }
├── ColorContext.tsx     # <ColorContextProvider> + useColorContext()
└── index.ts                    # barrel
```

`useActiveColors.ts` (the existing hook at the repo root of swillustrator) is
deleted; its body is folded into `useColorContextTool.ts`.

### `useColorContextTool(opts)` → `{ tool, api }`

Options:

```ts
interface UseColorContextToolOptions {
  initialFill?: ActivePaint;
  initialStroke?: ActivePaint;
  initialFocus?: 'fill' | 'stroke';
  /** Selection + scene adapter for the scene-write methods. */
  adapter: { applyBatch(ops: Op[]): void };
  getSelection: () => readonly string[];
  /** Scene helpers the scene-write methods need (id → current obj),
   *  matching what the App's existing applyFillToSelection closures use. */
  getNodeById: (id: string) => Obj | null;
}
```

### `ColorContextApi`

```ts
interface ColorContextApi {
  // Active-paint state (moves verbatim from useActiveColors)
  fill: ActivePaint;
  stroke: ActivePaint;
  focused: 'fill' | 'stroke';
  setFill(p: ActivePaint): void;
  setStroke(p: ActivePaint): void;
  setFocused(p: ActivePaint): void;
  setFocus(which: 'fill' | 'stroke'): void;
  setFillColor(color: string): void;
  setStrokeColor(color: string): void;
  setFocusedColor(color: string): void;
  focusedAlpha: number;
  setFocusedAlpha(a01: number): void;
  swap(): void;
  swapFocus(): void;
  toggleFocusedNone(): void;
  toggleFocusedTransparent(): void;
  reset(): void;

  // Scene-write routing (lifted out of App.tsx)
  applyFillToSelection(color: string): void;
  applyStrokeToSelection(color: string): void;
  applyStrokeWidthToSelection(w: number): void;
}
```

Scene-write methods read `getSelection()` for the id list and dispatch
`createUpdateNodeOp` ops via `adapter.applyBatch`. Their `coalesceKey`s
(`'active.fill' | 'active.stroke' | 'active.strokeWidth'`) collapse slider
drags into one undo entry — same behavior as today.

### `Tool`

```ts
defineTool<null>({
  id: 'color-context',
  presentation: {
    label: 'Color context',
    group: 'view',  // command-palette only; no icon
  },
  initial: {
    keyDown: {
      d: () => { api.reset(); return claim(); },
      x: (ctx) => {
        if (ctx.modifiers.shift) api.swapFocus(); else api.swap();
        return claim();
      },
      '/': () => { api.toggleFocusedNone(); return claim(); },
    },
  },
});
```

The four `useAction(...)` calls in the current hook are removed. The tool's
`initial.keyDown` flows through the same dispatcher, so prefs-driven
keybinding remap still works.

### Context

```tsx
export const ColorContext = createContext<ColorContextApi | null>(null);

export function ColorContextProvider({
  value,
  children,
}: {
  value: ColorContextApi;
  children: ReactNode;
}) {
  return (
    <ColorContext.Provider value={value}>
      {children}
    </ColorContext.Provider>
  );
}

export function useColorContext(): ColorContextApi {
  const v = useContext(ColorContext);
  if (!v) throw new Error('useColorContext must be used inside <ColorContextProvider>');
  return v;
}
```

## Migration

### App.tsx

- Replace `const colors = useActiveColors({...});` with
  `const { tool: colorContextTool, api: colors } = useColorContextTool({ adapter, getSelection: () => selection.current.map(String), getNodeById });`.
- Push `colorContextTool` into the ambient `tools` array.
- Delete the four `useAction(...)` calls that registered D / X / Shift-X / `/`.
- Delete the local `applyFillToSelection`, `applyStrokeToSelection`,
  `applyStrokeWidthToSelection` helper closures (moved onto `api`).
- Wrap the JSX subtree in `<ColorContextProvider value={colors}>`.
- Strip ~17 props from `<RightSidebar>` (the active-paint state, scene-write helpers, and focused-alpha pair).
- For tools that need to write active paint (eyedropper, etc.), pass `colors.setFocusedColor` (or the slice each tool needs) into the tool's options at construction.

### ActiveSwatches.tsx

`ActiveSwatchesProps` collapses to:

```ts
export interface ActiveSwatchesProps {
  compact?: boolean;
}
```

Body switches from `p.fill / p.stroke / p.onChangeFill / …` to `const colors = useColorContext();` and uses `colors.fill / colors.setFill / …`.

### RightSidebar (in App.tsx)

`RightSidebarProps` loses: `activeFill, activeStroke, setActiveFill, setActiveStroke, focusedSwatch, setFocusedSwatch, fillColor, setFillColor, strokeColor, setStrokeColor, strokeWidth, setStrokeWidth, applyFillToSelection, applyStrokeToSelection, applyStrokeWidthToSelection, focusedAlpha, setFocusedAlpha`.

Each panel that reads them calls `useColorContext()` directly.

### useEyedropperTool wiring

Today the App passes an `onPick` closure that calls
`setActiveFill / setActiveStroke / setFocused`. After the change, the closure
calls `colors.setFocusedColor(color)` (or a similar method that respects the
current focus).

## Testing

- Existing `useActiveColors` tests (if any) migrate alongside the hook.
- A new test covers the ambient-list keybinding path: render the dispatcher
  with the color-context tool plus a no-op active tool, fire `keydown` for
  `d` / `x` / `Shift+x` / `/`, assert the api method that fired.
- A new test covers the scene-write methods: mock the adapter, call
  `api.applyFillToSelection('#ff0000ff')` with a stubbed selection, assert
  the emitted op shape and coalesce key.

## Out of scope

- Migrating the color-context tool to the kit (`src/features/colors/`). Stays under apps/swillustrator/src/ per the TODO's "userland tool" framing.
- New coalesce-key strategies (the existing ones move verbatim).
- Subscribe-based / `useSyncExternalStore` consumers (Q2-A: React context is the only consumer surface in v1).
- A palette icon for the color-context tool (intentionally hidden — no pointer/drag).

## File changes summary

| Path | Change |
|---|---|
| `apps/swillustrator/src/tools/colorContext/useColorContextTool.ts` | new — folds in `useActiveColors.ts` body + scene-write methods |
| `apps/swillustrator/src/tools/colorContext/ColorContext.tsx` | new |
| `apps/swillustrator/src/tools/colorContext/index.ts` | new barrel |
| `apps/swillustrator/src/useActiveColors.ts` | deleted |
| `apps/swillustrator/src/App.tsx` | hook swap, provider wrap, prop drops, action-call deletions |
| `apps/swillustrator/src/ActiveSwatches.tsx` | props collapse, consumer switches to context |
| (eyedropper / other tools that mutate active paint) | rewire to `api.setFocusedColor` |
