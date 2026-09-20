---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

Turn labkit's React lint rules back on. Biome enables its `react` domain — `useExhaustiveDependencies` among them — by detecting react in `dependencies`, and labkit declares it as a `peerDependency`, which that detection does not read. The rules had gone quiet, and the four `biome-ignore` comments written against them had decayed into `suppressions/unused` errors, which is how the silence surfaced. The domain is now named explicitly in `biome.jsonc`; no hook-dependency defects were hiding behind it.

With the gate running again: `currentPage` trims a query and fragment with one regex instead of two non-null-asserted `split` results, `<Lab>`'s fallback returns without a wrapping fragment, and two tests drop non-null assertions. A `PaintField` swatch takes its inner radius from `--wzl-border-w` rather than a bare `1px`, and the icon gallery's group heading takes `--wzl-font-weight-bold` rather than `600`, a weight this theme's scale — 200 through 400 — does not contain.
