---
'@weasel-js/core': patch
'@weasel-js/parallax': patch
---

`viewportWorldRect` gives a flipped view (`scale.y < 0` for y-up, or `scale.x < 0`) a positive size: the rect now runs from its low corner, ending at the camera's corner on a flipped axis, where it used to report a negative width or height. A y-up canvas now draws the guides grid and the grid's cell highlight, a tiled parallax layer draws its copies, and paste placement, image fitting, `pageInView` and diagram fitting read the right area. A consumer that read the sign of `viewportWorldRect`'s size to detect a flip should read `view.scale` instead.

A rect aim carries the flip separately, so an aim still round-trips a flipped view: its extent is the new `AimRect`, a positive world rect with an optional `flip: { x, y }`, which `viewForAim` honors and the new `aimRectOf(view, size)` produces. An aim-held `<CanvasView>` takes an `AimRect` as `aim`, so it can now hold a y-up view.
