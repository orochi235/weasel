---
'@weasel-js/animator': minor
---

A clip carries its timeline's loop: `toClip` writes `loop` and `bindClip` gives it back beside the tracks.

```ts
const clip = toClip({ tracks: handle.tracks(), loop: handle.loop() });
animator.timeline({ ...bindClip(clip, binder) }); // loops as it did
```

<!-- entry: new api data -->
