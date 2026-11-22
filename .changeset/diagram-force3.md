---
'@weasel-js/diagram': minor
---

`force3` relaxes a diagram of solids in three dimensions, answering each moved node's new low corner as `{ x, y, z }`.

It reads each node's depth from the graph's new `GraphNode.box3`, which `buildGraph` fills when the frame answers `box3`. Solids that all share one z stay on it and land where `force` puts their faces. `createForceRelaxation` takes the dimensions as a third argument, its relaxation gains `placed3()`, and `ForceBody` gains `hd`, half the body's depth (0 in a flat run).

```ts
const frame = createSolidFrame<Pose3>({ box3: (p) => aabbOfPose(p), fromBox3: (box, p) => withAabb(p, box) });
const graph = buildGraph(sceneParticipants(scene), { frame });
for (const [id, to] of force3(graph)) {
  const pose = scene.get(id)!.pose;
  const from = frame.box3!(pose).min;
  scene.setPose(id, frame.translate3!(pose, { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }));
}
```

<!-- entry: rank=10 new api -->
