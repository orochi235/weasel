---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

`@weasel-js/diagram/layout` and `@weasel-js/core/math` are new subpaths that a
Node process can import: measuring a box from its rows, ranking a graph,
relaxing one under forces, and finding where on a box's perimeter an edge
should leave, with no React in the module graph. A server rendering a diagram
needed all of that and could not have it — the diagram barrel reaches `live`
(a hook) and `connect` (an interaction), and core's reaches the canvas.

`layout` exports `measureBody`/`sizeToBody`, `layered`/`ranksOf`/`backEdges`,
`force`, `tree`, `COMPASS` and the rest of `ports`, `outline` and `onOutline`.
A caller with its own nodes and edges implements `Graph` — an interface, not a
class — over what it already has, so `buildGraph`, which reads one out of a
scene, is not needed and is not there. The routers stay behind: they live with
the scene registry, and they are typed in `Vec2`, so a consumer routing in
three dimensions cannot call them regardless.

The seven modules behind it now import `@weasel-js/core/math` rather than the
core barrel. Every symbol they took is in the subpath, so this narrows what
they ask for rather than moving anything.

`scripts/check-react-free.mjs` (`npm run check:react-free`) walks each entry's
**built** closure, through sibling packages' `exports` maps, and fails on a
React specifier. Sources cannot answer this question: `core/math` re-exports
nineteen leaf modules that each import only numbers, and its first build still
pulled a megabyte of canvas — one leaf reached core's own barrel, and
`splitting: true` put the result in a chunk the entry imported.
