---
'@weasel-js/animator': patch
---

`ClipValue`'s object arm is `object`, so a pose typed by an interface (`RectPose`, a `TaggedTypedArray`) is a clip key's `value` without a cast. It was an index signature, which no interface satisfies. Breaking for code that read a member straight off a `ClipValue`: narrow it to its own type first. `toClip` still refuses a value JSON cannot round-trip.
