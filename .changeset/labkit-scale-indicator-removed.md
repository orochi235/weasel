---
'@weasel-js/labkit': major
---

`ScaleIndicator` is gone; labkit re-exports ui's `ScaleBar`, which the trial status strip now shows.

`ScaleBar` takes the zoom as screen pixels per world unit and measures in the frame's unit scopes, pixels by default. It does not read the zoom from a surrounding `CanvasStack`, so pass it. The status strip's bar has the class `lk-scale-bar` in place of `lk-scale-indicator`.

```tsx
// before: 50 px a foot at zoom 1
<ScaleIndicator zoom={zoom} unit="ft" pixelsPerUnit={50} />
// after
<ScaleBar zoom={(zoom * 50) / 12} scopes={[{ system: IMPERIAL_INCHES }]} />
```

<!-- entry: breaking api visual -->
