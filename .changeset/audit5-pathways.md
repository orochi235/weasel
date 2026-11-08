---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
'@weasel-js/diagram-formats': patch
'@weasel-js/geom': patch
'@weasel-js/gestures': patch
'@weasel-js/icons': patch
'@weasel-js/icons-plugin': patch
'@weasel-js/labkit': patch
'@weasel-js/p-touch': patch
'@weasel-js/paint': patch
'@weasel-js/registry': patch
'@weasel-js/renderer': patch
'@weasel-js/routing': patch
'@weasel-js/svg': patch
'@weasel-js/theme': patch
'@weasel-js/ui-logic': patch
---

Fixes from an audit of ui-logic, editor and the icon packages, and one definition each for decisions several packages answered separately:

- The icons plugin reads the namespace of an `icons.gen` compiled to JavaScript, so its `icon()` calls are rewritten as a TypeScript one's are.
- Releasing an icon table a second time no longer bumps the registry's version and notifies its subscribers.
- `envPx` reads a token set to a bare `0` as 0px, as CSS does, instead of using its fallback or throwing.
- New in geom: `trimNumber(n, places = 6)`, which pathToD, svg and the renderer's mesh writer now share. The mesh writer kept four decimal places where its comment said it matched svg's six; it now writes six.
- New in geom: `rectBetween(ax, ay, bx, by)`, the rect two corners span, used by core's drag rect, marquee, area select, anchor marquee, insert extent, measurement and parallax, and by diagram's segment boxes.
- New in registry: `freshId(base, taken, opts)`, the first free numbered id, used by core's `nextPageId`, diagram's stage, wire, group and sequence ids, and labkit's snapshot names.
- paint exports `byteHex` and `lerpHueDeg`. core's `withAlpha01` and p-touch's lbx colors write hex through the first. theme's ramps blend hues through the second, so two anchors exactly opposite now blend the positive way round, as CSS's `shorter` does, where before they went the negative way.
- gestures' `matchKey` takes a readonly key list, and routing's key bindings match through it.
- ui-logic's `clampTo` is now geom's `clamp` under another name, and is deprecated.
