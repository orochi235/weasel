---
'@weasel-js/core': patch
---

A `targetScale` given to `<DeviceProfileProvider value>`, or to `<SceneCanvas device>`, now reaches what reads the profile beneath it, the canvas's own handle and hit sizes among them. Each reader re-derived the scale from the pointer type, so the override was dropped one level down.
