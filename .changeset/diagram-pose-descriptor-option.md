---
'@weasel-js/diagram': major
---

diagram's options take the pose descriptor as `poseDescriptor`, the name `<SceneCanvas>` gives the same thing; they took `geometry`.

This covers every options bag that reads a pose's bounds through one: the shape, label, group, mark, port, edge, graph, layout, live-layout and connect options among them. A sequence root's saved `geometry` is a different thing and is unchanged.

```ts
// before
registerDiagramShape({ geometry: RECT_POSE_DESCRIPTOR });
// after
registerDiagramShape({ poseDescriptor: RECT_POSE_DESCRIPTOR });
```

<!-- entry: breaking api -->
