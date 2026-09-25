---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Types that public props already use are now exported, so inferring a type through them no longer fails with TS2742. `@weasel-js/ui` exports `SegmentTooltipFields`. `@weasel-js/labkit/weasel-ui` re-exports `OverlayPortalProps`, `PropertyAlign`, `PropertyDensity`, `PropertyMetricProps`, `SegmentTooltipFields`, `StanceProps` and `WithoutPortalTarget`; `@weasel-js/labkit/loupe` re-exports `LoupeMode` and `LoupePoint`; and `@weasel-js/labkit` and `@weasel-js/labkit/config` export `SectionOption`, `DialogSpec` and `InDialogOptions`.
