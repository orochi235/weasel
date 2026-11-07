---
'@weasel-js/hud': patch
---

A window drag that was canceled put the window back where the drag started without telling `onMove` or `onResize`, so a consumer tracking its bounds kept the dragged ones. A pixel-mode loupe resized and then canceled kept a readback sized for the dragged lens, stretched to the wrong magnification until the aim next moved. The restored bounds now go through the same callback the drag used.
