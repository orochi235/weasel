---
'@weasel-js/text': major
---

`fitTextPose` is `fitBoxToText`, and its options `FitBoxToTextOptions`: it sizes a text pose's box to its text.

```ts
// before
const pose = fitTextPose(textPose, { axis: 'both' });
// after
const pose = fitBoxToText(textPose, { axis: 'both' });
```

<!-- entry: breaking api -->
