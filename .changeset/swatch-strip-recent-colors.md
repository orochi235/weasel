---
'@weasel-js/ui': patch
---

Add `SwatchStrip`, a recently-used row over a preset palette, and the recent-colors store behind it. Additive: nothing changes outside a provider.

- `createRecentColorsStore({ limit, storage, key })` keeps the colors most recent first, deduped by color rather than spelling and capped at 12 by default. It persists to `localStorage` unless given another `storage` or `null`, and every storage access is guarded, so a blocked or full storage leaves a working in-memory list.
- `<RecentColorsProvider store>` turns recording on for the pickers beneath it: `ColorField` (and so `PaintInput`, `PaintField`, `GradientEditor` stops and `MeshEditor` corners), `SwatchGrid` and `FillStrokeSwatch` record what they commit. `useRecentColors` reads the list; `useRecordRecentColor` lets a custom picker join in.
- `<SwatchStrip>` shows the recents and one of its `palettes`, with a picker when there is more than one. `BUILTIN_PALETTES` holds `STANDARD_PALETTE` and `BASIC_PALETTE`; a consumer passes its own list. Recent swatches are named by their color, for example "#ff0000, 50% opacity" (`describeColor`).
