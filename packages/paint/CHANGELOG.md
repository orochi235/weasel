# @weasel-js/paint

## 1.4.2

## 1.4.1

## 1.4.0

## 1.4.0-pre.1

## 1.4.0-pre.0

## 1.3.0

### Patch Changes

- 94f2446: Add stroke markers — arrowheads and other line terminators as stroke style.
  
  `markerStart` / `markerMid` / `markerEnd` on `Stroke` take a key resolved
  through a new registry (`registerMarker`), shipping eight built-in shapes.
  Unlike SVG, the stroke stops short of a filled head rather than running under
  it to the tip; the distance is declared per marker, so an open V still reaches
  the vertex. Round-trips through `@weasel-js/svg` as `marker-*` attributes plus
  `<marker>` defs.

## 2.0.0-pre.0

### Patch Changes

- 94f2446: Add stroke markers — arrowheads and other line terminators as stroke style.

  `markerStart` / `markerMid` / `markerEnd` on `Stroke` take a key resolved
  through a new registry (`registerMarker`), shipping eight built-in shapes.
  Unlike SVG, the stroke stops short of a filled head rather than running under
  it to the tip; the distance is declared per marker, so an open V still reaches
  the vertex. Round-trips through `@weasel-js/svg` as `marker-*` attributes plus
  `<marker>` defs.
