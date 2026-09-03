---
'@weasel-js/labkit': patch
---

Export a lab's picture with its marks on it — new API, and new chrome.

A target declares `base()`, handing over the picture underneath its marks as
SVG markup, an image `src` or a canvas. labkit cannot rasterize that itself: it
is the consumer's DOM. A target declaring no base still exports, its marks on
transparency.

`AnnotationsApi` grows `capture(target, { format, scale })`, resolving to a
Blob plus its dimensions, and `targets()`, which reports the declared targets.
The route depends on the base: an SVG one nests beside the marks in a single
document that rasterizes once at the end, which also makes `format: 'svg'` a
real vector export. Anything else stacks rasters, the marks drawn offscreen at
export scale by `renderSceneToPixels` rather than read back off the live
surface — so a capture neither depends on nor disturbs what is on screen.
Export resolution follows the target's content box and the scale, not the size
the pane happens to be on screen.

Declaring `annotations` now earns an Export button in the trial toolbar, opening
a panel that picks a target, PNG or SVG, and a scale, and then downloads or
copies. `AnnotationsCapability.onCapture` fires after every export, labkit's own
chrome included, for a host that wants to file the blob somewhere of its own.

Two smaller additions come with it: `createMarkDrawOne` / `resolveMarkStyle`,
the single place a mark's colour and stale dash are resolved for both the
screen and an export, and `markSvgNodes`, which translates a mark's own draw
commands into `SvgNode`s rather than switching over the mark kinds a second
time.

labkit gains a dependency on `@weasel-js/svg`. Its build already inlined that
package by way of `@weasel-js/ui`, so nothing about what ships changes; the
declaration is what the manifest audit reads.

One caveat for anyone using React Aria overlays inside a lab: they portal to
`document.body` by default, which is outside the element labkit paints its
theme tokens onto, and they render unthemed there. The export panel passes the
lab root as its portal container. Nothing else in labkit does yet.
