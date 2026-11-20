---
'@weasel-js/diagram': minor
---

A diagram can live on a plane of its own: every diagram reader takes a `frame`, a `LayoutFrame` saying how a pose's box is read and moved there.

Layout, ports, edge routing, cluster and anchor boxes, label and off-page tag stations, the connect gesture and the painters all read geometry through it. Unset, the frame is the pose descriptor's own space (`layoutFrameOf(poseDescriptor)`), so a 2D canvas and its saved data are unchanged. A 3D host whose descriptor answers in screen pixels passes the projection onto the diagram's plane; stored waypoints, routes and port anchors are then coordinates on that plane.

```ts
const ground: LayoutFrame<Pose3> = {
  box: ({ p, s }) => ({ x: p[0] - s[0] / 2, y: p[2] - s[2] / 2, width: s[0], height: s[2] }),
  translate: (pose, dx, dy) => ({ ...pose, p: [pose.p[0] + dx, pose.p[1], pose.p[2] + dy] }),
  fromBox: (b, pose) => ({ p: [b.x + b.width / 2, pose.p[1], b.y + b.height / 2], s: [b.width, pose.s[1], b.height] }),
};
layoutDiagram(scene, sceneParticipants(scene), 'layered', { poseDescriptor, frame: ground });
```

`frameFor`, `layoutFrameOf`, `AUTO_LAYOUT_FRAME` and the `FrameOptions` and `LayoutFrame` types are exported.

<!-- entry: rank=10 new api -->
