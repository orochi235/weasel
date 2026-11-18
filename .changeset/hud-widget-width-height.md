---
'@weasel-js/hud': major
---

hud widget bounds and options name their size `width` and `height`, so a widget's bounds pass straight to geom and the renderer.

`WidgetBounds` is now geom's `Rect`. `ButtonOptions`, `RectOptions`, `ImageOptions`, `ListOptions` and `WindowOptions` take `width`/`height` in place of `w`/`h`, and `WindowOptions` takes `minWidth`/`minHeight` in place of `minW`/`minH`. `SourceRect` is removed; an image's `source` is a geom `Rect`.

```ts
// before
hud.window({ id: 'tools', x: 12, y: 12, w: 240, h: 180, minW: 120, title: 'Tools' });
const right = widget.bounds.x + widget.bounds.w;
// after
hud.window({ id: 'tools', x: 12, y: 12, width: 240, height: 180, minWidth: 120, title: 'Tools' });
const right = widget.bounds.x + widget.bounds.width;
```

<!-- entry: breaking api -->
