---
'@weasel-js/minimap': patch
---

The minimap's `'scene'` and `'live'` fits, and `computeFitView` with them, frame each mark where it draws. They used to read a mark's stored pose, which is local to its container, so a scene with content nested in containers (or on pages) was framed off-center and cropped.
