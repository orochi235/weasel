---
'@weasel-js/geom': patch
'@weasel-js/paint': patch
'@weasel-js/core': patch
---

Three live path effects: a blend between two shapes, a shape bent along a path, and copies of a shape along a path. Each is one scene node whose `dependsOn` names its sources and whose path and pose both derive from them, so editing a source — moving it, or dragging its anchors — updates the effect, and it saves and loads under the kit's own registry key, `kit:pathEffect`. `pathEffectNode(effect, sources, layer)` makes one; `data.pathEffect` holds its settings.

The actions are in the standard set and the `paths` preset, in the `pathEffects` group (`PATH_EFFECTS_GROUP`): `blend` (Mod+Alt+B) over the first two selected shapes, `bendAlong` (Mod+Alt+W) and `repeatAlong` (Mod+Alt+R) laying the first selected shape along the second, `editPathEffect` changing an effect's settings as one coalescing undo step, and `expandPathEffect` (Mod+Alt+E, "Expand to Paths") replacing an effect with the ordinary paths it shows. `ActionParamSchema` types their params for `<SceneCanvas tune>`.

A blend matches anchors contour to contour, splitting the shape with fewer at its longest segments until the counts agree, and picks the second shape's start point and direction to keep matched anchors closest; `startOffset` and `reverse` override that. Fill and stroke mix through OKLab, and a turned source turns its neighbors rather than squashing them.

A `derivePath` can now paint in several parts, each in its own fill and stroke: return `pathFromParts(parts)`, and the `kit:derived` painter draws each part as itself while picking and bounds see one path.

`@weasel-js/geom` adds the geometry: `prepareBlend` and `blendPaths`, `bendAlongPath` (refit to a tolerance, corners kept), `stationsAlongPath` and `repeatAlongPath`, `measurePath` (arc length measured once, with an optional smoothed heading, which `pointAlongPath` now uses), and `pathToCubicContours` / `cubicContoursToPath`. `@weasel-js/paint` adds `lerpPaint`, `lerpFill` and `lerpStroke`.
