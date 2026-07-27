# focus

DOM focus tracking for the canvas, plus a render-layer gate that consumes it.

Two files, deliberately independent of `Canvas` / `SceneCanvas` — this is a
pure feature module. Consumers compose the hook with `gateLayer` (or their own
gate) to hide affordances when the canvas is blurred.

## `useCanvasFocus`

Returns three things, and the distinction between the last two matters:

| | Use for |
| --- | --- |
| `focused` | React state. Re-renders on change. Use in JSX. |
| `focusProps` | Spread onto the focusable element — `tabIndex`, `onFocus`, `onBlur`. |
| `getFocused()` | Stable getter. Use **inside per-frame closures**. |

`getFocused()` exists because a `RenderLayer` is constructed **once** but its
`draw` runs **every frame**. Closing over the `focused` boolean captures
whatever it was at construction time and never updates. Reach for the getter
whenever the read happens during paint.

## `gateLayer`

Wraps a `RenderLayer` so it emits draw commands only when a predicate passes.
`id`, `label`, `defaultVisible`, `alwaysOn`, and `space` flow through
unchanged, so a gated layer is still addressable by the same id.

```ts
gateLayer({ layer: selectionOverlay, visible: getFocused })
```

The `visible` option is a **getter**, not a boolean, for exactly the reason
above.

## Relationship to chrome-caps

[`../chrome-caps`](../chrome-caps/README.md) covers the same ground
declaratively and more completely — its `focused` atom reads the same signal,
and it gates hit-test as well as paint. For a rule that's expressible as a
chrome-caps rule, prefer that. `gateLayer` is the escape hatch for layers
outside the chrome-id vocabulary, and for bare-`<Canvas>` consumers that
haven't adopted chrome-caps.
