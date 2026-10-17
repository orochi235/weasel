---
'@weasel-js/hud': patch
---

The WebGL context menu closes on a wheel outside its panels, when the window loses focus and on resize, as the DOM menu does. Closing it with Escape, a chosen item or any of those gives HUD focus back to the widget that held it when the menu opened, with its focus ring if it had one; a press that moves focus elsewhere keeps that focus.
