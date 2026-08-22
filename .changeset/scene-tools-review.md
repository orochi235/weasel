---
'@weasel-js/core': patch
---

Correctness pass over the tools, canvas, interactions and affordances layers.

Fixed, each with a test: a UI-driven ongoing action (color/opacity pickers)
committed a second time when `cancelAll` had already ended its handle; the
`align.*` and `distribute.*` descriptors reported themselves permanently
disabled, greying out every `<ActionBar>` entry; `reorder.backward`,
`align.*`, `distribute.*` and `pathfinder.*` read deps they never declared in
`requires`, which throws in dev builds and silently bypasses a consumer's
history in production; `ActionsRegistry.begin` ignored `requires` and so never
passed the paint actions their `applyOps`; `Canvas.hitTestExtras` handed
registered layers `undefined` where `draw` gets live data, making
`composeAffordanceLayer`'s hit-test throw; `<Canvas>` never disposed its GL
renderer on unmount; `useTools` returned a stale registry when a tool was
added after mount; an `actions` prop override deleted the default action it
merged onto when the prop object was rebuilt; picking and marquee selected
nodes on hidden layers; a throwing drop-zone `onDrop` stranded every later
pointer drag; `snapBackOrDelete`'s `'snap-back'` policy left the node where it
was dropped; a cancelled pen handle-drag left the anchor it placed; and anchor
affordances on a second selected path routed their drag into the path actually
being edited.

Removed as unreachable: `useViewportTools`, `Canvas.previewBoundsExtra`,
`marqueeDrawCommands`, `applyHitExistingGate`, and the `enableKeyboard` options
on `useAlign` / `useDistribute`, which documented a registration those hooks do
not perform — `useStandardActions` owns it. The public `InsertOverlayStyle`
type `marqueeDrawCommands` carried is unchanged and still exported.
