---
'@weasel-js/diagram': major
---

Avoid routing previews a drag of a shape inside a container, or of the container itself, with connectors running to where the shapes are drawn.

`avoidSceneInput`'s third argument is the transform frame's map of stored poses, folded through the containers above each node, in place of a function giving world poses.

```ts
// before
avoidSceneInput(scene, opts, (id) => frame.get(id));
// after
avoidSceneInput(scene, opts, frame);
```

<!-- entry: breaking api fix visual -->
