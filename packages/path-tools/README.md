# @weasel-js/path-tools

Path-editing tools for a weasel canvas, each family a preset an app turns on
beside core's own.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic
scene-graph engine for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/path-tools).

```sh
npm install @weasel-js/path-tools
```

Core keeps the path geometry, the path-edit state and its overlay. This package
holds the editing itself, on core's public surface: path edit and its anchors
tool, anchors and handles, bending a segment, Join, Average, Cut at crossings,
Simplify, Offset, Create Outlines and Outline Stroke, the pen, the pencil and
the knife, and the tools below.

```tsx
import { SceneCanvas } from '@weasel-js/core';
import { pathToolsPreset, usePathToolsTools } from '@weasel-js/path-tools';
import { drawPreset } from '@weasel-js/editing';

const tools = usePathToolsTools();
<SceneCanvas scene={scene} features={[drawPreset, pathToolsPreset]} tools={tools} />;
```

`pathToolsPreset` turns every family on but Drape and handle snapping, which
change what every anchor or handle drag does. Each is also a preset of its own,
and an app that imports only some never loads the others:

| Preset | What it adds |
|---|---|
| `pathsPreset` | Path edit (`pathEditPreset`: double-click a path to open it, the `anchors` tool, anchor and handle editing, bending a segment), its keys (`anchorKeysPreset`), the path commands (`pathCommandsPreset`: Simplify, Offset, Cut at crossings, Join), and Create Outlines and Outline Stroke (`outlinesPreset`). Every other preset here assumes it |
| `sandPreset` | `sand`, which `useSandTool` binds: Sand, a path-edit tool that refits the curve it passes over |
| `handleLocksPreset` | The `handleLock.angle` and `handleLock.length` toggles |
| `createDrapePreset` | Drape: dragging anchors also moves the anchors near them along the path, by a falloff over a radius in screen pixels that the wheel scrubs mid-drag; the reach is drawn as a band. Not in `pathToolsPreset` |
| `handleSnapPreset`, `createHandleSnapPreset` | Handle snapping: a dragged handle's angle snaps to steps and to the line through its anchor's other handle, through a snap session whose angles `handleSnapSource` offers. Not in `pathToolsPreset` |
| `bridgePreset` | Bridge: join open ends with a curve along each end's heading, on paths or on two anchors |
| `spiroPreset` | Spiro curves: path edit edits a spiro node's points and solves the curve again through them, `setSpiroKind` sets the kind of the selected points, and `releaseSpiro` converts a spiro curve to an ordinary path; `useSpiroTool` (Shift+P) draws them |
| `tugPreset` | `tugPath`, which `useTugTool` binds: Tug, a path-edit tool whose drag on an open end grows the path along its end tangent or curvature, or trims it back |
| `snipPreset`, `reachPreset`, `kneadPreset` | The actions `useSnipTool`, `useReachTool`, and `useKneadTool` bind |
| `fairingPreset` | Fairing (`fairAnchors`), which makes smooth anchors curvature-continuous by their handle lengths |
| `anchorSelectionPreset` | Grow and shrink the anchor selection along the path, or select every Nth anchor, the corners, the smooth anchors, or the rest |
| `resamplePreset` | Resample: anchors spread evenly by arc length, adjusted afterward in the last-operation panel |
| `addExtremesPreset` | Add extremes: an anchor at each curve's leftmost, rightmost, top, and bottom |
| `curvatureCombPreset` | The curvature comb over the open path, under chrome id `path-edit.comb` |
| `poisePreset` | Poise and Equalize, from grips under chrome id `path-edit.poise` |
| `constraintsPreset` | Path constraints: the actions, their marks, and every edit finished so they hold |
| `pathStructurePreset` | Make start point and Reverse path direction, and arrows showing which way the open path runs, under chrome id `path-edit.direction` |
| `segmentTypePreset` | Turn segments straight or curved, from the selection (Shift+C) or under a Shift+double-click |
| `filletPreset` | Fillet: a widget in each corner anchor whose drag sets its radius (`editFillet`), and `setFillets` and `cycleFillet` on the selected corners; `FILLET_CONTROLS` and `useFilletControls` are a panel over them |
| `pathEffectsPreset` | Tween, Bend along, Repeat along, Text along, Roughen, Zigzag, and Pucker & Bloat, and the actions that edit, release and expand them |
| `warpPreset` | Expand and configure a held warp; `usePlaneWarpTool`, `useClothWarpTool`, and `usePinWarpTool` bring their own drags |

`PATH_EDIT_TOOLS` names the path-edit tools, the anchors tool, Sand and Tug, and `usePathEditTools` builds them,
beside `DRAW_TOOLS` (the pen, pencil and spiro pen), `SLICE_TOOLS` (the knife), `RESHAPE_TOOLS` and `usePathToolsTools`.
Each path-edit tool carries `edits-anchors`, so only path edit allows it; Sand's and Tug's bindings outrank anchor
editing's, and path edit starts on the `anchors` tool, which binds nothing. The pen's, pencil's and knife's dot sizes
and reaches are kit settings (`targets.pen*`, `targets.slice*`), whose prefs schema is `pathToolsKitSettingsSchema`.
The reach of an anchor click is core's `targets.anchorClickPx`, which the `editAnchors` dep's `anchorUnder` reads.

`createPathEditHost()` is a `<SceneCanvas pathEdit>` host that holds the open path and its selected anchors itself
and says when either changes, so the one object is also a `redrawOn` source and what a panel over the open path
reads (`useFilletControls`). Given `modes` (`@weasel-js/modes`' registry), path edit is a mode: opening a path enters
it, and closing the path leaves it for `exitMode`.

## Text Along Path

Select a text node and a path and run Text Along Path (Alt+Shift+X): the text's glyphs stand on the path, and follow
edits to either. It is a path effect like Bend Along, with these options:

| Option | Values |
|---|---|
| `align`, `start` | which part of the text sits at `start`, and where on the path that is, as a fraction of its length |
| `shift`, `anchor` | how far off the path, and whether the baseline or the x-height middle sits on it |
| `overflow` | `clip` cuts text at the path's end; `fit` squeezes the gaps between glyphs until it fits |
| `side` | `auto` (whichever reads upright), `path` (the path's own left side), `flipped`. Turning text over keeps it in place; on an open path, letters that fall off are dropped |

Only the text's first laid line follows the path. A color glyph (an emoji) keeps its advance and paints nothing, and
underline, strikethrough and overline are not drawn. The node's rotation and skew are ignored; its scale is a
font-size factor.

The sources are hidden while the effect shows them (every effect's create action takes
`hideSources` in its params; Text Along Path sets it unless told not to). Release shows them again, as one undo step, and Delete, Cut and Expand take them with the effect.
Double-clicking the curved text edits the hidden text in place; Enter path edit on the effect edits its path.

The comb, poise lines, constraint marks, and direction arrows are off until
chrome-caps shows them; the fillet widgets show until it hides
`path-edit.fillets`. The toggles `pathEdit.show.direction`, `.comb`,
`.poise`, and `.fillets` (group `pathOverlays`) come with their presets and
flip that rule through core's `chromeRules` dep. To keep them as preferences,
mount `pathEditAidsSchema` in the app's schema and pass its values to
`pathEditAidsVisibility(aids)`, the canvas's `chromeVisibility`;
`PATH_EDIT_AID_CHROME_IDS` names each aid's chrome id. `createCurvatureCombPreset`, `createPoisePreset`,
`createConstraintsPreset`, `createPathStructurePreset`, and
`createFilletPreset` take their look. They reach path edit through core's
`PathEditExtension`: marks drawn on the open path, parts of it to press, marks
a click selects and Delete removes, a share of an anchor or handle drag, what
an edit keeps true, and, for spiro curves, how a path drawn from another form
is edited. `createDrapePreset` takes a function returning its options,
read as each drag starts, and `createHandleSnapPreset` options or a function
read on every move; null from either function turns the feature off.

The tools are hooks, mounted with `<SceneCanvas tools>` as core's are; each
binds an action its family's preset registers, so turn on both.
`usePathToolsTools()` builds every one, keyed by id, and the sets `WARP_TOOLS`,
`RESHAPE_TOOLS`, and `PATH_TOOLS_TOOLS` name them for a palette's `include`. Two carry their
own actions and need no preset:

| Tool | What it does |
|---|---|
| `useGirthTool` (Shift+W) | Shapes a stroke's `vertexWidths` by dragging its edges |
| `useShapeBuilderTool` (Shift+M) | With two or more paths selected, a drag unites the faces their outlines cut each other into, and an Alt-drag deletes them; it reads the `booleansAdapter` dep, which `@weasel-js/editing`'s `booleansPreset` publishes over the canvas's path leaves (`pathToolsPreset` and `pathfinderPreset` include it). `planShapeBuilder` is the engine under it |
