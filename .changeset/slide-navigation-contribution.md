---
'@weasel-js/core': minor
---

`createPresentationContribution()` steps a paged canvas through its pages one at a time, gliding the view to fit each.

Pass it to `<SceneCanvas ambient>`. The arrow keys, Page Up and Page Down, Home and End run its `present.step` action, and `present.go` shows a page by id or index; both fit the view with `fitViewToPage` and glide through the `view` dep's animation. The pages default to the scene's page run, and a step starts from whichever page the view shows most.

```tsx
const ambient = useMemo(() => [createPresentationContribution({ wrap: true, onPage: (page) => setShown(page) })], []);
<SceneCanvas scene={scene} ambient={ambient} />
```

Options: `pages`, `wrap`, `animate` (default on), `fit` (as `fitViewToBounds` takes it), `keys` (default on), and `onPage`. A host stepping the canvas from outside it, such as a presentation runtime with keys of its own, passes `keys: false` and calls `stepPresentation(canvasCamera(api), pages, { by: 1 })` on the canvas handle.

<!-- entry: rank=10 new api -->
