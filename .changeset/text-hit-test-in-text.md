---
'@weasel-js/text': patch
'@weasel-js/core': patch
---

text: `pointInTextPose`, `caretIndexAt`, `fitTextPose`, `renderLabel`, `defaultLabelTextRenderer`, and `isTextData` live here now, with the `PointInTextPoseOpts`, `FitTextPoseOptions`, and `LabelOptions` types. None of them needed a scene. `@weasel-js/core` still exports every one of them.
