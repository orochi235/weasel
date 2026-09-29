---
"@weasel-js/ui": patch
"@weasel-js/forge": patch
---

`ToastRegion` takes a `portalContainer`, and follows an `OverlayPortalProvider`,
like the other overlays. Given a container, the stack renders inside it,
absolutely positioned in the container's corner, so a toast raised in a forge
trial stays in that trial; the container must be a containing block. With
neither, the region is fixed to the viewport corner exactly as before — it does
not follow the nearest themed ancestor, since that is usually a page-tall app
root. A contained region is not an F6 landmark; its toasts announce, dismiss,
pause on hover and focus, and return focus the same way. Additive.

forge's Toast story no longer renders in its own frame, and
`check:forge-isolate` now allows one isolated story.
