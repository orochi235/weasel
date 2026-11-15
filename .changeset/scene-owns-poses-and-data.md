---
'@weasel-js/core': major
---

A pose or `data` value handed to the scene is the scene's from then on, and a development build freezes it, so writing into one throws.

The scene and its undo history keep these values by reference, so a write into one changed the document behind history's back. Build a new value and pass it in instead of editing one you passed before or read back:

```ts
// before
const pose = { x: 0, y: 0, width: 10, height: 10 };
scene.setPose(id, pose);
pose.x = 5; // silently moved the node and rewrote its undo entry
// after
scene.setPose(id, { ...pose, x: 5 });
```

Only plain objects and arrays are frozen; typed arrays and class instances are left writable, and the same rule holds for them unguarded. A production build freezes nothing. `toJSON()` returns a copy of these values, typed arrays included, so a snapshot stays as it was through later edits and is yours to edit; `loadState` and `sceneFromJSON` copy a save in, so a save you load is never frozen.

<!-- entry: rank=10 breaking behavior -->
