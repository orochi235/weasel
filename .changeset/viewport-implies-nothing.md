---
'@weasel-js/core': major
---

`<SceneCanvas viewport>` no longer turns navigation on; only `presets.view` does.

Breaking: a canvas that passed `viewport` without `view` (or `draw`, or `whiteboard`) stops wheel-panning, zooming, and pinching, and loses its hand tool. Add `presets.view`, which `viewport` then configures; a development build warns when `viewport` is passed without it:

```tsx
<SceneCanvas features={[presets.view, presets.pick]} viewport={{ animatedZoom: true }} />
```

A hand tool named in `defaultTools` still drags the view without `presets.view`.

<!-- entry: rank=10 breaking behavior -->
