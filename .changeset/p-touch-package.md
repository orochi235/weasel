---
"@weasel-js/p-touch": patch
"@weasel-js/core": patch
"@weasel-js/diagram-formats": patch
---

Add `@weasel-js/p-touch`, Brother P-touch labels from a scene. `renderLabel` draws a label at one pixel per
printer dot over the band the printhead reaches, and `printLabel` sends it over WebUSB or Web Serial through
obwat, split into pages at cut marks. `sceneToLbx` and `writeLbx` write an `.lbx` file with rects, open
polylines and plain text boxes as objects P-touch Editor can edit, and the rest drawn and placed as images.

Core gains `commandRasterizer`, the hook that draws commands a file format cannot express through a
`RasterSession`. It was `diagram-formats`' private `pageRasterizer`, which `exportPagesPdf` now uses from core.
