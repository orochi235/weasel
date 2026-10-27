---
'@weasel-js/hud': patch
---

The HUD's render layer declares `deps`, which hold for as long as no widget would draw anything different: the same widgets in the same order, each with the same `hidden`, bounds and `deps`, under the same focus and canvas size. A canvas then reuses the layer's commands instead of asking every widget again, and once the layer is large enough for its retain policy, keeps its pixels instead of drawing its text again each frame. A showing widget that declares no `deps`, or paints `content` from the scene, still redraws the layer every frame.
