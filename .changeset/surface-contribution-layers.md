---
'@weasel-js/core': minor
---

A `SurfaceContribution` can carry hit-tested layers in `layers`, so one `ambient` entry installs a feature whose chrome takes presses.

`layers` are registered on the canvas as `registerLayer` would register them, in entry order with the last hit first, and that order holds when an entry is rebuilt. An `overlay` is still painted only.

```tsx
const handles: SurfaceContribution = { id: 'handles', eligibility: { claimed: true }, layers: [handleLayer], bindings, actions };
<SceneCanvas ambient={[handles]} />
```

<!-- entry: rank=10 api new -->
