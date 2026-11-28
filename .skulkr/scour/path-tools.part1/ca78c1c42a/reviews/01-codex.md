# Review saturation for `path-tools.part1`

Snapshot `ca78c1c42a92855c2a3e72ac749e4854d9c29849`. The tracked working tree was clean at the start of review. Scope is the 37 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Host state ownership, mode transitions and React control snapshots | 2 | 2 | 0 |
| 2 | Stroke-edge and brush hit testing across paths and view scales | 2 | 4 | 0 |
| 3 | Constraint link planning, traversal and glyph placement | 0 | 4 | 1 |
| 4 | Topology-changing anchor commands, corner radius limits and widget inputs | 0 | 4 | 2 |
| 5 | Gesture settings, action wiring and public entry points | 0 | 4 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. The path-edit host borrows the caller's mutable selection

[createPathEditHost.ts](packages/path-tools/src/host/createPathEditHost.ts#L89) · Pass 1 · P3 · Source-traced

Pass a Set containing anchor zero to setSelectedAnchors, then add another anchor to that Set. selectedAnchors now reports the new index, but the host emits no notification for the mutation. A panel or canvas subscribed to the host can keep showing the earlier selection until an unrelated redraw.

### 2. Fillet controls throw during server rendering

[useFilletControls.ts](packages/path-tools/src/fillet/useFilletControls.ts#L61) · Pass 1 · P3 · Source-traced

Render a component calling useFilletControls with ordinary scene and selection sources through React's server renderer. The hook supplies subscribe and getSnapshot to useSyncExternalStore but omits getServerSnapshot, which React requires during server rendering. Rendering fails even when both sources are stable and contain no open path.

### 3. A girth drag can pick an anchor on a different subpath from the grabbed stroke edge

[widthEdit.ts](packages/path-tools/src/girth/widthEdit.ts#L104) · Pass 2 · P2 · Source-traced

Use a compound path with a long horizontal subpath at y=0 and an endpoint of a second subpath at (50,4). At unit scale with six units of reach and a two-unit centered stroke, grab the first subpath's lower edge near (50,-1). Its centerline projection is (50,0), so the search of all anchors finds the unrelated endpoint four units away. gripAt then changes that endpoint's width instead of inserting a width point into the subpath under the press.

### 4. Knead can move artwork outside its visible brush ring

[knead.ts](packages/path-tools/src/knead/knead.ts#L67) · Pass 2 · P2 · Source-traced

Use a view with scale x=4 and y=1 and a brush radius of 40 pixels. pxReach returns the larger axis extent, 40 world units, and the action uses that as a circular world-space radius for the deformation and text intersection. A point 20 world units away horizontally is inside that circle despite being 80 pixels from the center of the 40-pixel cursor. It can move during the stroke even though it is visibly outside the brush.

Source and tests were left untouched.
