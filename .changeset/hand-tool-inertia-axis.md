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

`apps/site/demos/ParallaxDemo.tsx` has been asking for `inertia: {}` since it
was written and will now actually coast.
