---
"@weasel-js/core": patch
"@weasel-js/labkit": patch
---

`createPoseFeed(scene)` is the channel a renderer weasel does not own uses to
keep its objects in step with a `Scene`. It publishes `added` / `removed` /
`changed` with effective poses, so a retained renderer mutates only what moved
instead of rebuilding every node's draw record on any change.

It reads the scene's two clocks separately. Committed edits bump
`Scene.getVersion()` and cost one `O(n)` walk of three reference comparisons per
node — the scene mutates node objects in place and swaps their `pose` and `data`
references, so it is those the feed snapshots. A drag lives in `Scene.overrides`,
which names the ids it touched and costs `O(changed)`, so the walk never runs on
the hot path. A `FeedNode` carries the effective pose beside the node's committed
one, so a host can draw both without a second channel.

The delta carries no order: a host that draws in order re-reads
`renderOrderNodes()`, which is cached until a structural edit. The feed does not
coalesce notifications either — that is the host scheduler's job.

The 3D lab is the first host.
