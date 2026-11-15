---
'@weasel-js/core': major
---

`<SceneCanvas viewport>` no longer turns navigation on; only `viewPreset` does.

Breaking: a canvas that passed `viewport` without `view` (or `draw`, or `whiteboard`) stops wheel-panning, zooming, and pinching, and loses its hand tool. Add `viewPreset`, which `viewport` then configures; a development build warns when `viewport` is passed without it:

```tsx
<SceneCanvas features={[viewPreset, pickPreset]} viewport={{ animatedZoom: true }} />
```

A hand tool named in `defaultTools` still drags the view without `viewPreset`.

<!-- entry: rank=10 breaking behavior -->
