---
'@weasel-js/parallax': patch
'@weasel-js/guides': patch
'@weasel-js/diagram': patch
'@weasel-js/plot': patch
---

Fixes to tiled layer stacking, ruler ticks zoomed far out, the obstacle-avoiding router's spatial index, and sizes in plot and snapPoint that hung on huge values.

- A tiled layer draws a `space: 'screen'` source in its place among its sources. Before, every screen-space source was drawn under all the tiled ones, so a HUD listed last sat under the backdrop.
- `rulerTicks` lays out no ticks once labeled ones would sit under a pixel apart. Zoomed out past the longest step a unit system has (a `PIXELS` document near the zoom floor), it made hundreds of thousands to millions of ticks per ruler, every frame.
- The obstacle-avoiding router no longer hangs on a connector whose waypoint is infinite, and no longer walks millions of cells for one a billion units away: its spatial hash checks an item or a query spanning thousands of cells by its box instead of filing or visiting each cell.
- Packet charts hold bits per row to 1–128 and draw fields up to bit 4095 (512 bytes); radar charts draw 1–20 rings. The editors' inputs carry these maxima and clamp a larger value typed in, and a spec loaded from text is held to them when drawn. A huge value used to hang the chart: `bitsPerRow: 1e9` built a billion-key scale, a field to bit `1e12` cut billions of row pieces, and `ticks: 1e9` drew a billion rings. A NaN bits per row or ring count now falls back to the default (32, 5).
- `snapPoint({ pattern: 'grid' })` offers at most 129 × 129 points, those around the dragged child's pose, where a spacing tiny next to the container listed billions of drop targets.
