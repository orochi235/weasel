---
'@weasel-js/core': minor
---

Types core's public functions take or return are now exported, so a consumer can write them down.

`PageTreeReader` (`pageIdOf`), `ScreenMap` (`strokedBounds`), `ScrollableContainer` (`scrollableAt`'s result), `SelectRangeDep` and `RangeBetween` (the `selectRange` dep), `SelectionLayerCommon` (`SelectionOverlayLayerOptions`), `SkinScene` (what `RigScene` extends), `PointRegionShape` (`pointRegionFrame`), `KitInsertKind` (the kit's keys of `InsertNodeFactories`) and `ResolvedPaintFields` (`withInheritedPaint`'s result). `CoordTraceEntry` is exported from `@weasel-js/core`, and `PathEditState` and `AnchorMarquee` from `@weasel-js/core/test-seams` beside `EditAnchorsStateRef`.

The pen tool's in-progress anchor, which `PenSubpath.anchors` holds, is exported as `PenDraftAnchor`. `PenAnchor` stays the path anchor from `@weasel-js/geom`.

<!-- entry: api -->
