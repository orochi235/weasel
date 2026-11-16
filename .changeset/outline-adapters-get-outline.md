---
'@weasel-js/core': major
---

`BooleansAdapter` and `CreateOutlinesAdapter` take `getOutline` in place of `getTextSource`, reading any kind's outline.

This is breaking. Answer `getOutline(id)` with `sceneNodeOutline(scene, id)`, which asks the node's painter and resolves its inherited paint and text box padding itself. A failed conversion reports `reason: 'outlines'` with a `NodeOutlineError` (`pending` while a face loads, `summary` for the user) in place of `'text-outlines'` and `TextOutlinesError`; Create Outlines with nothing to convert reports `reason: 'no-outlines'`; `warnTextOutlines` is now `warnOutlines`, and its notice id is `'outlines'`; `withTextOutlines` is now `withOutlines`, and `textIsStroked` gives way to `NodeOutline.stroked`.

```ts
// before
getTextSource: (id) => ({ data: textDataOf(id), pose: textBoxOf(...) }),
// after
getOutline: (id) => sceneNodeOutline(scene, id),
```

<!-- entry: rank=5 breaking api -->
