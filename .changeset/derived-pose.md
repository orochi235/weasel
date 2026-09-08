---
'@weasel-js/core': patch
---

A scene node can now derive its **pose** from its dependencies, the way it
already derived its path. New API; a group's bounds change behavior.

`Node.derivePose` takes the same `dependsOn` list as `derivePath`, serializes
through `SceneRegistry.derivePose` by key, and rides the same push
invalidation. Where a derived path is resolved at paint time and reaches only
the painter, a derived pose is what the node *is* at — it feeds bounds,
hit-testing, selection chrome, snapping and layout.

`dependsOn` gains a second form, `'children'`: "my own children, in child
order", which a fixed id list cannot express because reparenting would have to
maintain it. The two forms differ in lifetime as well as membership — deleting
a node still deletes everything that names it in `dependsOn`, but a container
outlives the children it derives from, because an emptied group is still a
group.

`groupAction` uses it, which fixes the group-bounds defect: a container's union
AABB was computed once at creation and never re-derived, so moving a member
left the group's bounds, selection chrome and hit area behind. The kit
registers the union function under `kit:unionOfChildren` and merges its own
registry entries under the consumer's, so a grouped document round-trips
through `toJSON` in any scene.

`effectivePose(scene, node)` is the one rule — override, else derived, else
authored — and now takes the scene rather than the override table alone. The
three render walks, the pick walk, and the scene, commit and gesture adapters
all resolve through it or through `documentPose`, the same answer minus the
override step for a reader that must not see an in-flight gesture. Both are
exported.

`clipFromPose`, `derivePath` and `derivePose` now share one table-driven
serialization path (`core/scene/nodeFnFields.ts`) instead of a copy per field.
