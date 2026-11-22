---
'@weasel-js/forge': minor
---

A CSF control's `argTypes` `if` reads the args the story renders with, frame-local ones from `updateArgs` included.

A story loader can give its `LoadedStory` an `onAnswersStale` subscription; the frame listens to it and answers the schema again under the same config.

<!-- entry: fix api -->
