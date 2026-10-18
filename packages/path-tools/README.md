# @weasel-js/path-tools

Path-editing tools for a weasel canvas, each family a preset an app turns on
beside core's own.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/path-tools).

```sh
npm install @weasel-js/path-tools
```

Core keeps basic path editing: anchors and handles, bending a segment, Join,
Average, Cut at crossings, Simplify, and Offset. This package adds the rest,
on core's public surface:

```tsx
import { SceneCanvas } from '@weasel-js/core';
import { pathTools } from '@weasel-js/path-tools';

<SceneCanvas scene={scene} features={['draw', pathTools]} />;
```

`pathTools` turns every family on but soft selection and handle snapping, which
change what every anchor or handle drag does. Each is also a preset of its own,
and an app that imports only some never loads the others:

| Preset | What it adds |
|---|---|
| `simplifyBrushPreset` | The Simplify brush, a path-edit tool that refits the curve it passes over |
| `handleLocksPreset` | The `handleLock.angle` and `handleLock.length` toggles |
| `createSoftSelectionPreset` | Soft selection: dragging anchors also moves the anchors near them along the path, by a falloff over a radius in screen pixels that the wheel scrubs mid-drag; the reach is drawn as a band. Not in `pathTools` |
| `handleSnapPreset`, `createHandleSnapPreset` | Handle snapping: a dragged handle's angle snaps to steps and to the line through its anchor's other handle, through a snap session whose angles `handleSnapSource` offers. Not in `pathTools` |
| `bridgePreset` | Bridge: join open ends with a curve along each end's heading, on paths or on two anchors |
| `spiroPreset` | Spiro curves: path edit edits a spiro node's points and solves the curve again through them, `setSpiroKind` sets the kind of the selected points, and `releaseSpiro` converts a spiro curve to an ordinary path; `useSpiroTool` (Shift+P) draws them |
| `lengthenPreset` | Lengthen, a path-edit tool whose drag on an open end grows the path along its end tangent or curvature, or trims it back |
| `trimPreset`, `extendPreset`, `smudgePreset` | The actions `useTrimTool`, `useExtendTool`, and `useSmudgeBrushTool` bind |
| `harmonizePreset` | Harmonize curvature |
| `anchorSelectionPreset` | Grow and shrink the anchor selection along the path, or select every Nth anchor, the corners, the smooth anchors, or the rest |
| `resamplePreset` | Resample: anchors spread evenly by arc length, previewed live |
| `addExtremesPreset` | Add extremes: an anchor at each curve's leftmost, rightmost, top, and bottom |
| `curvatureCombPreset` | The curvature comb over the open path, under chrome id `path-edit.comb` |
| `balancePreset` | Balance handles and Equalize, from grips under chrome id `path-edit.balance` |
| `constraintsPreset` | Path constraints: the actions, their marks, and every edit finished so they hold |
| `pathStructurePreset` | Make start point and Reverse path direction, and arrows showing which way the open path runs, under chrome id `path-edit.direction` |
| `segmentTypePreset` | Turn segments straight or curved, from the selection (Shift+C) or under a Shift+double-click |
| `cornerShapePreset` | Corner shape: a widget in each corner anchor whose drag sets its radius (`editCorner`), and `setCorners` and `cycleCornerShape` on the selected corners; `CORNER_CONTROLS` and `useCornerControls` are a panel over them |
| `pathEffectsPreset` | Blend, Bend along, and Repeat along, and the actions that edit and expand them |
| `warpPreset` | Expand and configure a held warp; `useDistortTool`, `useEnvelopeTool`, and `usePuppetTool` bring their own drags |

The comb, balance lines, constraint marks, and direction arrows are off until
chrome-caps shows them; the corner widgets show until it hides
`path-edit.corners`. `createCurvatureCombPreset`, `createBalancePreset`,
`createConstraintsPreset`, `createPathStructurePreset`, and
`createCornerShapePreset` take their look. They reach path edit through core's
`PathEditExtension`: marks drawn on the open path, parts of it to press, marks
a click selects and Delete removes, a share of an anchor or handle drag, what
an edit keeps true, and, for spiro curves, how a path drawn from another form
is edited. `createSoftSelectionPreset` takes a function returning its options,
read as each drag starts, and `createHandleSnapPreset` options or a function
read on every move; null from either function turns the feature off.

The tools are hooks, mounted with `<SceneCanvas tools>` as core's are; each
binds an action its family's preset registers, so turn on both. Two carry their
own actions and need no preset:

| Tool | What it does |
|---|---|
| `useGirthTool` (Shift+W) | Shapes a stroke's `vertexWidths` by dragging its edges |
| `useShapeBuilderTool` (Shift+M) | With two or more paths selected, a drag unites the faces their outlines cut each other into, and an Alt-drag deletes them; it reads core's `booleansAdapter` dep, which `<SceneCanvas>` publishes over its path leaves. `planShapeBuilder` is the engine under it |
