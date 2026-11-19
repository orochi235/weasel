# Audit round 39 — core.canvas.part1

## A refused gesture's reason text never shows for a gesture inside a `<CanvasView>`
- where: packages/core/src/canvas/SceneCanvas.tsx:163 (SceneCanvasInner), packages/core/src/canvas/GestureReason.tsx:29 (GestureReason)
- scenario: a surface with a second view (`views` prop or `<CanvasView>`); a drag that starts inside the view's rect is routed to the view's own dispatcher (`useViewDispatcher` creates one per view). Its action posts a `reason` overlay. The canvas half paints through the view's helpers, but `<GestureReason>` is mounted once, subscribed only to the surface's dispatcher and mapping `reason.at` through the surface's `viewRef`, so no text tag appears. Should watch every registered view's dispatcher and map through that view's camera and rect.
- evidence: read
- severity: medium

