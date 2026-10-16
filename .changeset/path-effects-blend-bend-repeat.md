---
'@weasel-js/geom': patch
'@weasel-js/paint': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Three live path effects: a blend between two shapes, a shape bent along a path, and copies of a shape along a path. Each is one scene node whose `dependsOn` names its sources and whose path and pose both derive from them, so editing a source — moving it, or dragging its anchors — updates the effect, and it saves and loads under the registry key `kit:pathEffect`. A scene holds path effects when it registers them — `createScene({ registry: withPathEffectsRegistry() })` — since reading a source's outline needs the painters; without that the actions are disabled. `pathEffectNode(effect, sources, layer, PATH_EFFECT_DERIVATIONS)` makes one; `data.pathEffect` holds its settings. Dragging an effect drags its sources; resizing or turning it resizes or turns them, as `shapeSources` now reaches through any node whose pose derives from named dependencies, not only a container's children.

The actions are in the standard set and the `paths` preset, in the `pathEffects` group (`PATH_EFFECTS_GROUP`): `blend` (Alt+Shift+B) over the first two selected shapes, `bendAlong` (Alt+Shift+W) and `repeatAlong` (Alt+Shift+R) laying the first selected shape along the second, `editPathEffect` changing an effect's settings as one coalescing undo step, and `expandPathEffect` (Alt+Shift+E, "Expand to Paths") replacing an effect with the ordinary paths it shows. `ActionParamSchema` types their params for `<SceneCanvas tune>`.

A blend matches anchors contour to contour, splitting the shape with fewer at its longest segments until the counts agree, and picks the second shape's start point and direction to keep matched anchors closest; `startOffset` and `reverse` override that. Fill and stroke mix through OKLab, and a turned source turns its neighbors rather than squashing them.

A `derivePath` can now paint in several parts, each in its own fill and stroke: return `pathFromParts(parts)`, and the `kit:derived` painter draws each part as itself while picking and bounds see one path.

`@weasel-js/routing` adds `BROWSER_RESERVED_CHORDS` and `browserReservedChord(spec)`: the key chords a major browser or desktop takes before the page does. The new bindings stay clear of them.

`@weasel-js/geom` adds the geometry: `prepareBlend` and `blendPaths`, `bendAlongPath` (refit to a tolerance, corners kept), `stationsAlongPath` and `repeatAlongPath`, `measurePath` (arc length measured once, with an optional smoothed heading, which `pointAlongPath` now uses), and `pathToCubicContours` / `cubicContoursToPath`. `@weasel-js/paint` adds `lerpPaint`, `lerpFill` and `lerpStroke`.
