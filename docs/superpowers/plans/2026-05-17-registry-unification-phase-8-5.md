# Registry unification — Phase 8.5: viewport descriptors + viewport wrapper dissolution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `viewport.pan` and `viewport.zoom` action descriptors with appropriate gesture-bindings (wheel, keyboard), then dissolve the wrapper-tools (`useWheelPanTool`, `useWheelZoomTool`, `useKeyboardZoomTool`).

**Architecture:** `viewport.pan` is an immediate action taking a delta param via `BindingOpts.params`. `viewport.zoom` is similarly immediate, taking a factor + center via params. Wheel bindings provide deltas from `WheelEvent`; keyboard bindings hardcode step sizes. Both invokers read+write `view` dep.

---

## Task 1: `viewport.pan` descriptor

```ts
export const viewportPanAction: Action = {
  id: 'viewport.pan',
  label: 'Pan viewport',
  gestureBinding: { kind: 'wheel' },  // any wheel
  requires: ['view'] as const,
  invoker: {
    timing: 'immediate',
    run: ({ view }, params) => {
      const deltaX = (params?.deltaX as number | undefined) ?? 0;
      const deltaY = (params?.deltaY as number | undefined) ?? 0;
      const current = view.get();
      view.set({ ...current, x: current.x - deltaX, y: current.y - deltaY });
    },
  },
};
```

The wheel binding's dispatcher pipeline needs to populate `BindingOpts.params` with `deltaX`/`deltaY` from `WheelEvent`. That's a new wiring — the dispatcher's wheel pump path must extract event deltas into params.

Extend the dispatcher's wheel handling: when matching a wheel binding, pack `event.deltaX`/`event.deltaY` into the synthesized `opts.params`. Then pass to immediate invoker.

## Task 2: `viewport.zoom` descriptor

Similar but for zoom. Reads `view`, applies `zoomAt(view, factor, center)` (helper exists at `src/core/viewport/zoomAt.ts`).

Two binding paths:
- Wheel + Ctrl: `{ kind: 'wheel', mods: { ctrl: true } }` — zoom centered at pointer position.
- Keyboard `=` / `-` / `0`: zoom in / out / reset.

Each binding registers with appropriate `opts.params`. Wheel binding extracts `event.deltaY` + cursor position; key binding provides hardcoded factor.

## Task 3: Dispatcher wheel-params extension

Modify `dispatcher.handleInput` to pack wheel-event fields into `BindingOpts.params` before calling invoker.run. Similar to how Phase 6 added pointer events to `InvocationCtx.drag`.

## Task 4: Register both + barrel-export

## Task 5: Dissolve `useWheelPanTool`

Per Phase 8 checklist. Delete wrapper; verify viewport.pan descriptor handles wheel events.

## Task 6: Dissolve `useWheelZoomTool`

Same. Note: wheel-zoom likely has special behavior (e.g., Cmd+wheel = zoom; bare wheel = pan). Verify the descriptors' gestureBindings express this correctly.

## Task 7: Dissolve `useKeyboardZoomTool`

Same. Keyboard bindings (`=` / `-` / `0`) need to be on the descriptor's gestureBinding array.

## Task 8: Verify + TODO

prepublishOnly + build:demo green; TODO updated.

## Risks

- **Wheel-event-to-params wiring is new.** Dispatcher modification required.
- **Cursor position for zoom-at-pointer.** Wheel events have `clientX/Y`; need to convert to world coords. Read `clientToWorld` from `src/core/viewport/clientToWorld.ts`.
- **Pinch-zoom dependency.** Phase 7.5 handles pinch; if not yet shipped, viewport.pinchZoom stays as wrapper for now.
