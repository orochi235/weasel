---
'@weasel-js/core': patch
---

**Breaking:** the pick functions take the world point as one `WorldPoint` argument in place of two positional numbers. A picker written `(worldX, worldY) => …` is now `(world) => …`, or `({ x, y }) => …`:

- `<SceneCanvas geometry={{ pickEvery }}>` and `<SceneCanvas selectTool={{ pickBest }}>`
- `useSelectTool`'s `pickEvery` and `pickBest` options
- `nestedHitTester`'s `pickOutermost` and `pickBest`
- `PickHud`'s `pickEvery` and `pickBest`

`pickBest` keeps its `alt` and `selection` arguments after the point. A 3D host's picker can now hand the point straight to a `nodeAtPoint` dep, which already took one.
