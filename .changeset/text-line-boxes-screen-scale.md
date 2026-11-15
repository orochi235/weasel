---
'@weasel-js/text': minor
---

`textLineBoxes` takes a `scale` option, so a `{ px }` font size is boxed where it draws at that view scale.

```ts
textLineBoxes(pose, { scale: meanScale(view.scale) });
```

<!-- entry: api -->
