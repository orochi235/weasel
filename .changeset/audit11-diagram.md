---
'@weasel-js/parallax': patch
'@weasel-js/guides': patch
'@weasel-js/diagram': patch
---

Fixes to tiled layer stacking, ruler ticks zoomed far out, and the obstacle-avoiding router's spatial index.

- A tiled layer draws a `space: 'screen'` source in its place among its sources. Before, every screen-space source was drawn under all the tiled ones, so a HUD listed last sat under the backdrop.
- `rulerTicks` lays out no ticks once labeled ones would sit under a pixel apart. Zoomed out past the longest step a unit system has (a `PIXELS` document near the zoom floor), it made hundreds of thousands to millions of ticks per ruler, every frame.
- The obstacle-avoiding router no longer hangs on a connector whose waypoint is infinite, and no longer walks millions of cells for one a billion units away: its spatial hash checks an item or a query spanning thousands of cells by its box instead of filing or visiting each cell.
