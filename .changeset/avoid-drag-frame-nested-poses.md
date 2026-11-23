---
'@weasel-js/diagram': major
---

Dragging a shape inside a container, or the container, previews avoid-routed connectors running to where the shapes are drawn.

`avoidSceneInput`'s third argument is the transform frame's map of stored poses, folded through the containers above each node, in place of a function giving world poses.

```ts
// before
avoidSceneInput(scene, opts, (id) => frame.get(id));
// after
avoidSceneInput(scene, opts, frame);
```

<!-- entry: breaking api fix visual -->
