---
'@weasel-js/core': patch
---

Wire the hand tool's `inertia` and `axis` options, which accepted a full
config and did nothing.

Both are now binding params on `viewport.dragPan`, so any consumer binding
that action gets them — not only `useHandTool`. `axis` drops one component of
every pan delta. `inertia` coasts the view after release through a new
optional `view.decay` dep, which `<SceneCanvas>` wires from `useDecayLoop`;
where no such dep is published the pan simply lands, as before.

`useVelocityTracker`'s logic is now also available hook-free as
`createVelocityTracker`, because an Action descriptor is a static object and
cannot call hooks. `InertiaConfig` moves next to `DecayLoopConfig` and
`PanBounds` in `useDecayLoop`; `useHandTool` re-exports it, so the
`HandToolInertiaConfig` alias on the barrel is unchanged.

`viewport.wheelPan` gains the same `axis` option through a
`makeViewportWheelPanAction` factory, matching its `makeViewportZoomAction` /
`makePinchZoomAction` siblings, and `<SceneCanvas viewport={{ pan: { axis } }}>`
reaches it. Two things fall out: `viewport={{ inertia: true }}` was documented
as "on with defaults" but produced no inertia — only the object form did — and
`ParallaxDemo` can drop the `setViewXOnly` commit clamp it used because the
axis options did not work.
