---
'@weasel-js/animator': minor
---

A nested timeline can play faster, backward, looped, sliced, frozen or scrubbed in its parent, by a `rate`, `loop` and blits `remap`.

Each means what it does on a blits voice, and a clip carries all three:

```ts
{ kind: 'timeline', at: 500, timeline: walk, rate: 2, loop: 3, remap: { window: [200, 800], curve: 'ease-in' } }
```

The track is sampled as a pure function of the parent's playhead, so it scrubs in any order. Its events fire where its clock runs forward and are not booked ahead.

<!-- entry: new api -->
