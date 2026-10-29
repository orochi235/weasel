---
'@weasel-js/core': patch
---

While the view moves, a canvas draws it with its translation rounded to whole device pixels, so a retained layer panned by a fraction of a pixel (kit inertia, trackpad momentum) is composited moved instead of drawn again every frame. Once the view holds, the canvas draws it exactly on the next frame. Hit-testing, `getView` and `clientToWorld` keep the exact view, so while moving the drawn and hit positions can differ by up to half a device pixel. `<Canvas retain={{ snap: false }}>` turns this off; `retain={false}` turns it off too.
